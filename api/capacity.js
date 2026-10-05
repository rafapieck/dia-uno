// GET /api/capacity — ¿se pueden crear casos nuevos? Solo responde sí o no (no expone cifras).
import { send, methodNotAllowed } from './_lib/http.js';
import { supabaseConfigured, getUser } from './_lib/supabase.js';
import { getCapacity, CAPACITY_MESSAGE } from './_lib/capacity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  if (!supabaseConfigured()) {
    return send(res, 503, { error: 'config', message: 'La app todavía no está configurada.' });
  }
  const user = await getUser(req);
  if (!user) return send(res, 401, { error: 'auth', message: 'Inicia sesión con Google para continuar.' });

  try {
    const { open } = await getCapacity();
    return send(res, 200, open ? { open } : { open, message: CAPACITY_MESSAGE });
  } catch (err) {
    console.error('capacity: no se pudo consultar', err?.status ?? 'error');
    return send(res, 500, { error: 'db', message: 'No pudimos revisar si hay lugar. Intenta de nuevo en un momento.' });
  }
}
