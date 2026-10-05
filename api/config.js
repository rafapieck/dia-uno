// Configuración pública para el navegador: URL de Supabase y llave anon (es pública por diseño).
// Nunca incluye la service_role ni otras llaves.
import { send, methodNotAllowed } from './_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return send(res, 503, { error: 'config', message: 'La app todavía no está configurada.' });
  }
  return send(res, 200, { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey });
}
