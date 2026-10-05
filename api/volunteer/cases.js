// GET /api/volunteer/cases — casos pendientes para el panel.
// Nunca regresa user_id, correo ni nombre de la víctima (PACKET §2).
import { send, methodNotAllowed } from '../_lib/http.js';
import { db, dbCount } from '../_lib/supabase.js';
import { requireVolunteer } from '../_lib/volunteer.js';
import { maxCasesPerVolunteer } from '../_lib/capacity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  try {
    const auth = await requireVolunteer(req, res);
    if (!auth) return;
    const me = auth.user.id;
    const [rows, active] = await Promise.all([
      db(
        'cases?select=id,user_id,description,incident_type,urgency,created_at,ai_simulated,callback_failed_at,callbacks(phone)' +
          '&status=eq.pending&order=created_at.asc',
      ),
      dbCount(`cases?select=id&owner_id=eq.${me}&status=eq.confirmed`),
    ]);
    const cases = rows.map(({ user_id, callbacks, ...c }) => {
      const cb = Array.isArray(callbacks) ? callbacks[0] : callbacks;
      return { ...c, phone: cb?.phone || null, own_case: user_id === me };
    });
    return send(res, 200, {
      cases,
      my_active: active,
      limit: maxCasesPerVolunteer(),
      is_coordinator: auth.volunteer.is_coordinator,
    });
  } catch (err) {
    console.error('volunteer/cases: error', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos cargar los casos.' });
  }
}
