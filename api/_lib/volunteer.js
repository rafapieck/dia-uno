// Solo usuarios dados de alta en `volunteers` pasan. Regresa { user, volunteer } o responde el error.
import { send } from './http.js';
import { supabaseConfigured, getUser, db } from './supabase.js';

export async function requireVolunteer(req, res) {
  if (!supabaseConfigured()) {
    send(res, 503, { error: 'config', message: 'La app todavía no está configurada.' });
    return null;
  }
  const user = await getUser(req);
  if (!user) {
    send(res, 401, { error: 'auth', message: 'Inicia sesión con Google para continuar.' });
    return null;
  }
  const rows = await db(`volunteers?select=user_id,is_coordinator&user_id=eq.${user.id}`);
  if (!rows?.length) {
    send(res, 403, { error: 'forbidden', message: 'Esta página es solo para voluntarias.' });
    return null;
  }
  return { user, volunteer: rows[0] };
}
