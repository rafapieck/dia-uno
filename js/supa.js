// Cliente mínimo de Supabase para el navegador, sin dependencias.
// Login con Google (flujo PKCE), sesión con renovación automática y consultas con RLS.
// Solo usa la llave anon (pública). La service_role nunca llega aquí.

const SESSION_KEY = 'diauno.session';
const VERIFIER_KEY = 'diauno.pkce';

let cfg = null;

const store = {
  get(storage, key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  },
  set(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch {
      /* modo privado: la sesión dura lo que la pestaña */
    }
  },
  remove(storage, key) {
    try {
      storage.removeItem(key);
    } catch {
      /* nada */
    }
  },
};

let memorySession = null;

export async function init() {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error('config');
  cfg = await r.json();
  return cfg;
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function redirectUrl() {
  return location.origin + location.pathname;
}

export async function signInWithGoogle() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  store.set(sessionStorage, VERIFIER_KEY, verifier);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectUrl(),
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: 's256',
  });
  location.assign(`${cfg.supabaseUrl}/auth/v1/authorize?${params}`);
}

function saveSession(s) {
  const session = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    user_id: s.user?.id || null,
  };
  memorySession = session;
  store.set(localStorage, SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  memorySession = null;
  store.remove(localStorage, SESSION_KEY);
}

// Si volvemos de Google con ?code=..., lo cambiamos por una sesión. Limpia la URL siempre.
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error_description') || params.get('error');
  if (!code && !error) return;
  history.replaceState(null, '', location.pathname);
  if (error) throw new Error('login');
  const verifier = store.get(sessionStorage, VERIFIER_KEY);
  store.remove(sessionStorage, VERIFIER_KEY);
  if (!verifier) throw new Error('login');
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  if (!r.ok) throw new Error('login');
  saveSession(await r.json());
}

async function refresh(session) {
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!r.ok) {
    clearSession();
    return null;
  }
  return saveSession(await r.json());
}

export async function getSession() {
  let session = memorySession;
  if (!session) {
    try {
      session = JSON.parse(store.get(localStorage, SESSION_KEY) || 'null');
    } catch {
      session = null;
    }
  }
  if (!session?.access_token) return null;
  if (session.expires_at - 60 < Date.now() / 1000) return refresh(session);
  memorySession = session;
  return session;
}

export async function signOut() {
  const session = await getSession();
  clearSession();
  if (session) {
    fetch(`${cfg.supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
  }
}

async function authHeaders() {
  const session = await getSession();
  if (!session) throw new Error('auth');
  return { Authorization: `Bearer ${session.access_token}` };
}

// Consulta directa a la base con la sesión del usuario: RLS decide qué puede ver.
export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json', ...(await authHeaders()) };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err = new Error('db');
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Llamada a nuestras funciones /api con la sesión del usuario.
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data: data || {} };
}
