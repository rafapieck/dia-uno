// POST /api/triage · PACKET §13 pruebas 15, 16, 17 y 18 (endpoint completo).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/triage.js';
import { makeReq, makeRes, setEnv, mockFetch, authRoute, spyConsole, SUPA, USERS } from './helpers.js';

let fetchMock;
let consoleSpy;
let inserted;

beforeEach(() => {
  setEnv();
  delete process.env.GEMINI_API_KEY;
  inserted = [];
  fetchMock = mockFetch([
    authRoute,
    {
      match: (u, init) => u.startsWith(`${SUPA}/rest/v1/cases`) && init.method === 'POST',
      reply: (u, init) => {
        const row = JSON.parse(init.body);
        inserted.push(row);
        return { status: 201, json: [{ id: 'case-1', status: 'pending', ...row }] };
      },
    },
  ]);
  consoleSpy = spyConsole();
});

afterEach(() => {
  fetchMock.restore();
  consoleSpy.restore();
});

async function post(description, token = 'tok-a') {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', token, body: { description } }), res);
  return res;
}

function assertNothingSavedOrLogged(text) {
  assert.equal(inserted.length, 0, 'no debe guardar nada');
  assert.ok(!fetchMock.calls.some((c) => c.url.includes('/rest/v1/')), 'no debe tocar la base');
  assert.ok(!consoleSpy.logged.some((l) => l.includes(text)), 'no debe loguear el texto');
}

test('sin sesión no se puede crear un caso (401)', async () => {
  const res = await post('me hakearon el wats y piden dinero', null);
  assert.equal(res.statusCode, 401);
  assert.equal(inserted.length, 0);
});

test('token inválido → 401', async () => {
  const res = await post('me hakearon el wats y piden dinero', 'tok-falso');
  assert.equal(res.statusCode, 401);
});

test('15 · "mi codigo es 482913" → bloqueado, la fila no existe, nada en logs', async () => {
  const text = 'mi codigo es 482913';
  const res = await post(text);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'secret');
  assert.equal(res.body.message, 'Nunca compartas eso, ni con nosotros.');
  assert.ok(!res.raw.includes('482913'), 'la respuesta no repite el secreto');
  assertNothingSavedOrLogged(text);
});

test('16 · NIP, tarjeta válida y CURP → bloqueados sin guardar', async () => {
  for (const text of [
    'mi nip es 1234 y me vaciaron la cuenta',
    'me clonaron la tarjeta 4111 1111 1111 1111',
    'me pidieron mi curp GOMR800101HMSRRB09 por telefono',
  ]) {
    const res = await post(text);
    assert.equal(res.statusCode, 422, text);
    assertNothingSavedOrLogged(text);
  }
});

test('17 · "me sacaron $150,000 pesos" NO se bloquea y se guarda', async () => {
  const res = await post('me sacaron $150,000 pesos');
  assert.equal(res.statusCode, 201);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].description, 'me sacaron $150,000 pesos');
  assert.equal(inserted[0].user_id, USERS['tok-a'].id, 'user_id sale del token, no del cliente');
});

test('18 · 3 letras y 2000 letras → 400 con mensaje claro, sin guardar', async () => {
  const corto = await post('hol');
  assert.equal(corto.statusCode, 400);
  assert.match(corto.body.message, /al menos 10/);
  const largo = await post('a'.repeat(2000));
  assert.equal(largo.statusCode, 400);
  assert.match(largo.body.message, /menos de 500/);
  assert.equal(inserted.length, 0);
});

test('redacción antes de guardar: sin teléfonos ni correos', async () => {
  const res = await post('me hakearon el wats 5512345678, escribanme a beto@gmail.com');
  assert.equal(res.statusCode, 201);
  assert.equal(inserted[0].description, 'me hakearon el wats [teléfono], escribanme a [correo]');
});

test('el cliente no puede mandar su propio user_id ni status', async () => {
  const res = makeRes();
  await handler(
    makeReq({
      method: 'POST',
      token: 'tok-a',
      body: { description: 'me hakearon el wats', user_id: USERS['tok-b'].id, status: 'confirmed' },
    }),
    res,
  );
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(inserted[0]).sort(), ['ai_simulated', 'description', 'incident_type', 'urgency', 'user_id']);
  assert.equal(inserted[0].user_id, USERS['tok-a'].id);
});

test('JSON inválido → 400', async () => {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', token: 'tok-a', body: '{no es json' }), res);
  assert.equal(res.statusCode, 400);
});

test('solo POST', async () => {
  const res = makeRes();
  await handler(makeReq({ method: 'GET', token: 'tok-a' }), res);
  assert.equal(res.statusCode, 405);
});

test('1/25 · sin llave de Gemini: guarda la sugerencia simulada con su marca', async () => {
  const res = await post('me hakearon el wats y piden dinero');
  assert.equal(res.statusCode, 201);
  assert.equal(inserted[0].incident_type, 'whatsapp');
  assert.equal(inserted[0].ai_simulated, true);
  assert.equal(res.body.case.ai_simulated, true);
});

test('Gemini solo recibe el texto redactado (sin teléfono ni correo)', async () => {
  process.env.GEMINI_API_KEY = 'gem-demo';
  fetchMock.restore();
  let sentToGemini = '';
  fetchMock = mockFetch([
    authRoute,
    {
      match: (u) => u.startsWith('https://generativelanguage.googleapis.com/'),
      reply: (u, init) => {
        sentToGemini = init.body;
        return { json: { candidates: [{ content: { parts: [{ text: '{"incident_type":"whatsapp","urgency":"alta"}' }] } }] } };
      },
    },
    {
      match: (u, init) => u.startsWith(`${SUPA}/rest/v1/cases`) && init.method === 'POST',
      reply: (u, init) => {
        const row = JSON.parse(init.body);
        inserted.push(row);
        return { status: 201, json: [{ id: 'case-2', ...row }] };
      },
    },
  ]);
  const res = await post('me hakearon el wats, mi numero es 5512345678 y mi correo beto@gmail.com');
  assert.equal(res.statusCode, 201);
  assert.ok(sentToGemini.includes('[teléfono]') && sentToGemini.includes('[correo]'));
  assert.ok(!sentToGemini.includes('5512345678') && !sentToGemini.includes('beto@gmail.com'));
  assert.equal(inserted[0].ai_simulated, false);
});
