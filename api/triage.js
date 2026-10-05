// POST /api/triage — recibe el relato de la víctima.
// Orden (PACKET §5, §12.4): sesión → longitud 10–500 → filtro de secretos → redacción → guardar.
// Si hay un secreto: se rechaza SIN guardar nada y SIN loguear el cuerpo.
import { send, readBody, methodNotAllowed } from './_lib/http.js';
import { supabaseConfigured, getUser, db } from './_lib/supabase.js';
import { checkDescription, findSecret, redact, secretLabel, SECRET_MESSAGE } from './_lib/secrets.js';

const CASE_FIELDS = 'id,description,incident_type,urgency,status,created_at,verified_at,ai_simulated,callback_failed_at';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!supabaseConfigured()) {
    return send(res, 503, { error: 'config', message: 'La app todavía no está configurada.' });
  }

  const user = await getUser(req);
  if (!user) return send(res, 401, { error: 'auth', message: 'Inicia sesión con Google para continuar.' });

  const body = readBody(req);
  const check = checkDescription(body?.description);
  if (!check.ok) return send(res, 400, { error: 'length', message: check.message });

  const secret = findSecret(check.text);
  if (secret) {
    return send(res, 422, {
      error: 'secret',
      message: SECRET_MESSAGE,
      detail: `Parece que escribiste ${secretLabel(secret)}. No lo guardamos. Bórralo y cuéntanos qué pasó sin ese dato.`,
    });
  }

  const description = redact(check.text);

  try {
    const rows = await db(`cases?select=${CASE_FIELDS}`, {
      method: 'POST',
      body: { user_id: user.id, description },
      prefer: 'return=representation',
    });
    return send(res, 201, { case: rows[0] });
  } catch (err) {
    console.error('triage: no se pudo guardar el caso', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos guardar tu caso. Intenta de nuevo en un momento.' });
  }
}
