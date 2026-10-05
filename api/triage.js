// POST /api/triage — recibe el relato de la víctima.
// Orden (PACKET §5, §12.4): sesión → capacidad → longitud 10–500 → filtro de secretos → redacción
// → sugerencia de la IA (solo con el texto redactado) → guardar.
// Si hay un secreto: se rechaza SIN guardar nada y SIN loguear el cuerpo.
import { send, readBody, methodNotAllowed } from './_lib/http.js';
import { supabaseConfigured, getUser, db } from './_lib/supabase.js';
import { checkDescription, findSecret, redact, secretLabel, SECRET_MESSAGE } from './_lib/secrets.js';
import { classify } from './_lib/classify.js';
import { getCapacity, CAPACITY_MESSAGE } from './_lib/capacity.js';

const CASE_FIELDS = 'id,description,incident_type,urgency,status,created_at,verified_at,ai_simulated,callback_failed_at';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!supabaseConfigured()) {
    return send(res, 503, { error: 'config', message: 'La app todavía no está configurada.' });
  }

  const user = await getUser(req);
  if (!user) return send(res, 401, { error: 'auth', message: 'Inicia sesión con Google para continuar.' });

  // Regla de paro: si el equipo está al máximo, no se crea el caso (ni se llama a la IA).
  let capacity;
  try {
    capacity = await getCapacity();
  } catch (err) {
    console.error('triage: no se pudo revisar la capacidad', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos revisar si hay lugar. Intenta de nuevo en un momento.' });
  }
  if (!capacity.open) {
    console.info('triage: caso rechazado por capacidad'); // métrica de la Condición 5 (sin datos de la víctima)
    return send(res, 409, { error: 'capacity', message: CAPACITY_MESSAGE });
  }

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
  const { incident_type, urgency, ai_simulated } = await classify(description);

  try {
    const rows = await db(`cases?select=${CASE_FIELDS}`, {
      method: 'POST',
      body: { user_id: user.id, description, incident_type, urgency, ai_simulated },
      prefer: 'return=representation',
    });
    return send(res, 201, { case: rows[0] });
  } catch (err) {
    console.error('triage: no se pudo guardar el caso', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos guardar tu caso. Intenta de nuevo en un momento.' });
  }
}
