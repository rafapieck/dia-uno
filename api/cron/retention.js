// GET /api/cron/retention — Vercel Cron, una vez al día (vercel.json).
// Cierra los casos con más de 7 días: el trigger borra la descripción y el callback.
import { send } from '../_lib/http.js';
import { supabaseConfigured, rpc } from '../_lib/supabase.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET || '';
  // Sin CRON_SECRET configurado, nadie puede correrlo (falla cerrado).
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return send(res, 401, { error: 'auth' });
  }
  if (!supabaseConfigured()) return send(res, 503, { error: 'config' });
  try {
    const closed = await rpc('close_stale_cases');
    console.info('retention: casos cerrados', closed);
    return send(res, 200, { closed });
  } catch (err) {
    console.error('retention: error', err?.status ?? 'error');
    return send(res, 500, { error: 'db' });
  }
}
