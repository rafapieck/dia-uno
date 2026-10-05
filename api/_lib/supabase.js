// Acceso a Supabase desde /api con fetch (sin dependencias).
// La service_role vive solo aquí, en el servidor. Nunca se manda al navegador.
import { bearerToken } from './http.js';

const env = (name) => process.env[name] || '';

export function supabaseConfigured() {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_ANON_KEY') && env('SUPABASE_SERVICE_ROLE_KEY'));
}

export class DbError extends Error {
  constructor(status) {
    super(`Supabase respondió ${status}`);
    this.status = status;
  }
}

function baseUrl() {
  return env('SUPABASE_URL').replace(/\/+$/, '');
}

function serviceHeaders(extra = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...extra };
  // Llaves "legacy" (JWT) también van en Authorization; las nuevas (sb_secret_…) solo en apikey.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// Valida el token del usuario con Supabase Auth. Regresa { id, email } o null.
export async function getUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const r = await fetch(`${baseUrl()}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}

// Llamada a PostgREST con service_role (se salta RLS: cada endpoint valida permisos antes).
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method,
    headers: serviceHeaders(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new DbError(r.status);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// Cuenta filas sin traerlas.
export async function dbCount(path) {
  const r = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: serviceHeaders({ Prefer: 'count=exact' }),
  });
  if (!r.ok) throw new DbError(r.status);
  const range = r.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function rpc(fn, args = {}) {
  return db(`rpc/${fn}`, { method: 'POST', body: args });
}
