// POST /api/volunteer/action — acciones de la voluntaria, siempre en el servidor con service_role.
//   set_type   { case_id, incident_type }  confirma o corrige el tipo (no libera nada)
//   no_answer  { case_id }                 "No contesta": el checklist sigue bloqueado
//   verified   { case_id }                 "Callback verificado": libera el checklist
import { send, readBody, methodNotAllowed } from '../_lib/http.js';
import { db, dbCount } from '../_lib/supabase.js';
import { requireVolunteer } from '../_lib/volunteer.js';
import { maxCasesPerVolunteer } from '../_lib/capacity.js';
import { INCIDENT_TYPES } from '../_lib/classify.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESCALATED = ['fraude', 'extorsion']; // dueño: coordinador (PACKET §9)

async function pendingCase(id) {
  const rows = await db(`cases?select=id,incident_type,status,callbacks(phone)&id=eq.${id}&status=eq.pending`);
  return rows?.[0] || null;
}

async function chooseOwner(auth, type) {
  if (!ESCALATED.includes(type) || auth.volunteer.is_coordinator) return auth.user.id;
  const coords = await db('volunteers?select=user_id&is_coordinator=eq.true&limit=1');
  return coords?.[0]?.user_id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  try {
    const auth = await requireVolunteer(req, res);
    if (!auth) return;
    const body = readBody(req) || {};
    if (!UUID.test(String(body.case_id || ''))) return send(res, 400, { error: 'input', message: 'Caso inválido.' });
    const c = await pendingCase(body.case_id);
    if (!c) return send(res, 404, { error: 'not_found', message: 'Ese caso ya no está pendiente.' });
    const filter = `cases?id=eq.${c.id}&status=eq.pending`;

    if (body.action === 'set_type') {
      if (!INCIDENT_TYPES.includes(body.incident_type)) {
        return send(res, 400, { error: 'input', message: 'Elige uno de los 5 tipos.' });
      }
      await db(filter, { method: 'PATCH', body: { incident_type: body.incident_type } });
      return send(res, 200, { ok: true });
    }

    if (body.action === 'no_answer') {
      await db(filter, { method: 'PATCH', body: { callback_failed_at: new Date().toISOString() } });
      return send(res, 200, { ok: true });
    }

    if (body.action === 'verified') {
      if (!INCIDENT_TYPES.includes(c.incident_type)) {
        return send(res, 400, { error: 'type', message: 'Primero confirma o corrige el tipo.' });
      }
      const cb = Array.isArray(c.callbacks) ? c.callbacks[0] : c.callbacks;
      if (!cb?.phone) return send(res, 400, { error: 'callback', message: 'La víctima todavía no deja un número.' });

      const owner = await chooseOwner(auth, c.incident_type);
      if (!owner) return send(res, 409, { error: 'coordinator', message: 'No hay coordinador dado de alta.' });
      const active = await dbCount(`cases?select=id&owner_id=eq.${owner}&status=eq.confirmed`);
      if (active >= maxCasesPerVolunteer()) {
        return send(res, 409, {
          error: 'limit',
          message: `Ya tiene ${active} casos activos (el límite es ${maxCasesPerVolunteer()}). No puede tomar otro.`,
        });
      }

      const now = new Date().toISOString();
      const updated = await db(`${filter}&select=id`, {
        method: 'PATCH',
        body: { status: 'confirmed', verified_at: now, confirmed_at: now, owner_id: owner },
        prefer: 'return=representation',
      });
      if (!updated?.length) return send(res, 404, { error: 'not_found', message: 'Ese caso ya no está pendiente.' });
      // El trigger también lo borra; aquí lo hacemos explícito.
      await db(`callbacks?case_id=eq.${c.id}`, { method: 'DELETE' });
      return send(res, 200, { ok: true, owner_is_me: owner === auth.user.id, escalated: ESCALATED.includes(c.incident_type) });
    }

    return send(res, 400, { error: 'input', message: 'Acción desconocida.' });
  } catch (err) {
    console.error('volunteer/action: error', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos guardar la acción. Intenta de nuevo.' });
  }
}
