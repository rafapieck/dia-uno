// Utilidades para probar los handlers de /api sin red: req/res falsos y fetch simulado.

export function makeReq({ method = 'GET', body, token, headers = {}, query = {}, url = '/' } = {}) {
  return {
    method,
    body,
    query,
    url,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  };
}

export function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(chunk) {
      this.raw = chunk;
      try {
        this.body = JSON.parse(chunk);
      } catch {
        this.body = chunk;
      }
    },
  };
}

export const SUPA = 'https://demo.supabase.co';

export function setEnv(extra = {}) {
  Object.assign(process.env, {
    SUPABASE_URL: SUPA,
    SUPABASE_ANON_KEY: 'anon-demo',
    SUPABASE_SERVICE_ROLE_KEY: 'service-demo',
    MAX_CASES_PER_VOLUNTEER: '5',
    CRON_SECRET: 'cron-demo',
    ...extra,
  });
}

// routes: [{ match: (url, init) => bool, reply: (url, init) => ({ status, json, headers }) }]
// Registra cada llamada en .calls.
export function mockFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const route = routes.find((r) => r.match(u, init));
    if (!route) throw new Error(`fetch no esperado: ${init.method || 'GET'} ${u}`);
    const { status = 200, json, headers = {} } = (await route.reply(u, init)) || {};
    const nullBody = status === 204 || init.method === 'HEAD' || json === undefined;
    return new Response(nullBody ? null : JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

// Usuarios válidos para /auth/v1/user según el token.
export const USERS = {
  'tok-a': { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'a@demo.test' },
  'tok-b': { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'b@demo.test' },
  'tok-v': { id: 'cccccccc-0000-4000-8000-000000000003', email: 'v@demo.test' },
  'tok-c': { id: 'dddddddd-0000-4000-8000-000000000004', email: 'c@demo.test' },
};

export const authRoute = {
  match: (u) => u === `${SUPA}/auth/v1/user`,
  reply: (u, init) => {
    const token = (init.headers.Authorization || '').replace('Bearer ', '');
    return USERS[token] ? { json: USERS[token] } : { status: 401, json: { msg: 'bad jwt' } };
  },
};

// Espía console.* para comprobar que nunca se loguea el texto de la víctima.
export function spyConsole() {
  const logged = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const originals = {};
  for (const m of methods) {
    originals[m] = console[m];
    console[m] = (...args) => logged.push(args.map(String).join(' '));
  }
  return {
    logged,
    restore() {
      for (const m of methods) console[m] = originals[m];
    },
  };
}

// Conteos para la regla de capacidad (HEAD con Prefer: count=exact).
export function capacityRoutes(state) {
  return [
    {
      match: (u, init) => init.method === 'HEAD' && u.startsWith(`${SUPA}/rest/v1/cases?`),
      reply: () => ({ headers: { 'content-range': `*/${state.active}` } }),
    },
    {
      match: (u, init) => init.method === 'HEAD' && u.startsWith(`${SUPA}/rest/v1/volunteers?`),
      reply: () => ({ headers: { 'content-range': `*/${state.volunteers}` } }),
    },
  ];
}
