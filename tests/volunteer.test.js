// Panel de la voluntaria · PACKET §13 pruebas 4 (dueño coordinador), 6, 7, 8 y 11.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import casesHandler from '../api/volunteer/cases.js';
import actionHandler from '../api/volunteer/action.js';
import { makeReq, makeRes, setEnv, mockFetch, authRoute, SUPA, USERS } from './helpers.js';

const CASE_ID = '11111111-2222-4333-8444-555555555555';
let db; // estado simulado
let fetchMock;

function routes() {
  return [
    authRoute,
    {
      match: (u) => u.startsWith(`${SUPA}/rest/v1/volunteers?`),
      reply: (u) => {
        if (u.includes('is_coordinator=eq.true')) return { json: db.volunteers.filter((v) => v.is_coordinator) };
        const id = /user_id=eq\.([\w-]+)/.exec(u)?.[1];
        return { json: db.volunteers.filter((v) => v.user_id === id) };
      },
    },
    {
      match: (u, init) => init.method === 'HEAD' && u.startsWith(`${SUPA}/rest/v1/cases?`),
      reply: (u) => {
        const owner = /owner_id=eq\.([\w-]+)/.exec(u)?.[1];
        const n = db.cases.filter((c) => c.owner_id === owner && c.status === 'confirmed').length;
        return { headers: { 'content-range': `*/${n}` } };
      },
    },
    {
      match: (u, init) => (init.method || 'GET') === 'GET' && u.startsWith(`${SUPA}/rest/v1/cases?`),
      reply: (u) => {
        const id = /[?&]id=eq\.([\w-]+)/.exec(u)?.[1];
        const rows = db.cases
          .filter((c) => c.status === 'pending' && (!id || c.id === id))
          .map((c) => ({ ...c, callbacks: db.callbacks[c.id] ? { phone: db.callbacks[c.id] } : null }));
        return { json: rows };
      },
    },
    {
      match: (u, init) => init.method === 'PATCH' && u.startsWith(`${SUPA}/rest/v1/cases?`),
      reply: (u, init) => {
        const id = /[?&]id=eq\.([\w-]+)/.exec(u)?.[1];
        const c = db.cases.find((x) => x.id === id && x.status === 'pending');
        if (c) Object.assign(c, JSON.parse(init.body));
        return { json: c ? [{ id }] : [] };
      },
    },
    {
      match: (u, init) => init.method === 'DELETE' && u.startsWith(`${SUPA}/rest/v1/callbacks?`),
      reply: (u) => {
        delete db.callbacks[/case_id=eq\.([\w-]+)/.exec(u)[1]];
        return { status: 204 };
      },
    },
  ];
}

beforeEach(() => {
  setEnv();
  db = {
    volunteers: [
      { user_id: USERS['tok-v'].id, is_coordinator: false },
      { user_id: USERS['tok-c'].id, is_coordinator: true },
    ],
    cases: [
      {
        id: CASE_ID,
        user_id: USERS['tok-a'].id,
        description: 'me hakearon el wats',
        incident_type: 'whatsapp',
        urgency: 'alta',
        status: 'pending',
        created_at: new Date().toISOString(),
        ai_simulated: false,
        callback_failed_at: null,
      },
    ],
    callbacks: { [CASE_ID]: '7771234567' },
  };
  fetchMock = mockFetch(routes());
});

afterEach(() => fetchMock.restore());

async function call(handler, token, { method = 'POST', body } = {}) {
  const res = makeRes();
  await handler(makeReq({ method, token, body }), res);
  return res;
}
const action = (token, body) => call(actionHandler, token, { body });
const theCase = () => db.cases[0];

test('solo voluntarias: una víctima recibe 403 en el panel y en las acciones', async () => {
  assert.equal((await call(casesHandler, 'tok-a', { method: 'GET' })).statusCode, 403);
  assert.equal((await action('tok-a', { action: 'verified', case_id: CASE_ID })).statusCode, 403);
  assert.equal(theCase().status, 'pending');
});

test('el panel no expone user_id, correo ni nombre de la víctima; sí el teléfono y la espera', async () => {
  const res = await call(casesHandler, 'tok-v', { method: 'GET' });
  assert.equal(res.statusCode, 200);
  const c = res.body.cases[0];
  assert.equal(c.user_id, undefined);
  assert.ok(!res.raw.includes(USERS['tok-a'].id) && !res.raw.includes('a@demo.test'));
  assert.equal(c.phone, '7771234567');
  assert.equal(c.own_case, false);
  assert.equal(res.body.limit, 5);
});

test('DEMO: si la voluntaria también es la víctima, el caso se marca como propio', async () => {
  theCase().user_id = USERS['tok-v'].id;
  const res = await call(casesHandler, 'tok-v', { method: 'GET' });
  assert.equal(res.body.cases[0].own_case, true);
});

test('6 · confirmar el tipo sin marcar callback NO libera el checklist', async () => {
  const res = await action('tok-v', { action: 'set_type', case_id: CASE_ID, incident_type: 'redes' });
  assert.equal(res.statusCode, 200);
  assert.equal(theCase().incident_type, 'redes');
  assert.equal(theCase().status, 'pending');
  assert.equal(theCase().verified_at, undefined);
});

test('set_type rechaza tipos fuera del catálogo', async () => {
  const res = await action('tok-v', { action: 'set_type', case_id: CASE_ID, incident_type: 'ninguno' });
  assert.equal(res.statusCode, 400);
});

test('7 · "No contesta" deja el checklist bloqueado y marca el intento', async () => {
  const res = await action('tok-v', { action: 'no_answer', case_id: CASE_ID });
  assert.equal(res.statusCode, 200);
  assert.equal(theCase().status, 'pending');
  assert.ok(theCase().callback_failed_at);
  assert.equal(db.callbacks[CASE_ID], '7771234567', 'el número se conserva para reintentar');
});

test('8 · "Callback verificado" libera el checklist y borra la fila de callbacks', async () => {
  const res = await action('tok-v', { action: 'verified', case_id: CASE_ID });
  assert.equal(res.statusCode, 200);
  const c = theCase();
  assert.equal(c.status, 'confirmed');
  assert.ok(c.verified_at && c.confirmed_at);
  assert.equal(c.owner_id, USERS['tok-v'].id);
  assert.equal(db.callbacks[CASE_ID], undefined);
});

test('no se puede verificar sin tipo confirmado ni sin número', async () => {
  theCase().incident_type = 'sin_clasificar';
  assert.equal((await action('tok-v', { action: 'verified', case_id: CASE_ID })).statusCode, 400);
  theCase().incident_type = 'whatsapp';
  delete db.callbacks[CASE_ID];
  assert.equal((await action('tok-v', { action: 'verified', case_id: CASE_ID })).statusCode, 400);
  assert.equal(theCase().status, 'pending');
});

test('4 · fraude (y extorsión) se asignan al coordinador', async () => {
  theCase().incident_type = 'fraude';
  const res = await action('tok-v', { action: 'verified', case_id: CASE_ID });
  assert.equal(res.statusCode, 200);
  assert.equal(theCase().owner_id, USERS['tok-c'].id);
  assert.equal(res.body.escalated, true);
});

test('11 · voluntaria con 5 casos activos no puede tomar el 6º', async () => {
  for (let i = 0; i < 5; i++) {
    db.cases.push({ id: `x${i}`, status: 'confirmed', owner_id: USERS['tok-v'].id });
  }
  const res = await action('tok-v', { action: 'verified', case_id: CASE_ID });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'limit');
  assert.equal(theCase().status, 'pending');
  assert.equal(db.callbacks[CASE_ID], '7771234567');
});

test('caso inexistente o ya verificado → 404; id inválido → 400', async () => {
  assert.equal((await action('tok-v', { action: 'verified', case_id: 'no-es-uuid' })).statusCode, 400);
  theCase().status = 'confirmed';
  assert.equal((await action('tok-v', { action: 'no_answer', case_id: CASE_ID })).statusCode, 404);
});
