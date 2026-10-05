// /api/breaches (HIBP por plataforma) y /api/cron/retention · PACKET §13 pruebas 13 (HIBP) y 24.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import breaches, { BREACH_NOTE } from '../api/breaches.js';
import retention from '../api/cron/retention.js';
import { makeReq, makeRes, setEnv, mockFetch, authRoute, SUPA, USERS } from './helpers.js';

let fetchMock;
beforeEach(() => setEnv());
afterEach(() => fetchMock?.restore());

const volunteerRoute = {
  match: (u) => u.startsWith(`${SUPA}/rest/v1/volunteers?`),
  reply: (u) => ({ json: u.includes(USERS['tok-v'].id) ? [{ user_id: USERS['tok-v'].id, is_coordinator: false }] : [] }),
};

test('HIBP: solo por dominio de la plataforma, con User-Agent, y con la nota de incertidumbre', async () => {
  fetchMock = mockFetch([
    authRoute,
    volunteerRoute,
    {
      match: (u) => u.startsWith('https://haveibeenpwned.com/api/v3/breaches?domain='),
      reply: () => ({ json: [{ Title: 'Ejemplo', BreachDate: '2021-04-03', PwnCount: 533000000, DataClasses: ['Phone numbers'] }] }),
    },
  ]);
  const res = makeRes();
  await breaches(makeReq({ method: 'GET', token: 'tok-v', query: { platform: 'facebook' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.breaches[0].title, 'Ejemplo');
  assert.equal(res.body.note, BREACH_NOTE);
  assert.match(BREACH_NOTE, /no significa que la cuenta esté a salvo/);
  const hibp = fetchMock.calls.find((c) => c.url.includes('haveibeenpwned'));
  assert.equal(hibp.url, 'https://haveibeenpwned.com/api/v3/breaches?domain=facebook.com');
  assert.ok(hibp.headers['User-Agent']);
});

test('HIBP: solo voluntarias y solo plataformas del catálogo (nunca correos)', async () => {
  fetchMock = mockFetch([authRoute, volunteerRoute]);
  let res = makeRes();
  await breaches(makeReq({ method: 'GET', token: 'tok-a', query: { platform: 'facebook' } }), res);
  assert.equal(res.statusCode, 403);
  res = makeRes();
  await breaches(makeReq({ method: 'GET', token: 'tok-v', query: { platform: 'beto@gmail.com' } }), res);
  assert.equal(res.statusCode, 400);
  assert.ok(!fetchMock.calls.some((c) => c.url.includes('haveibeenpwned')));
});

test('24 · cron sin CRON_SECRET correcto → 401 y no toca la base', async () => {
  fetchMock = mockFetch([]);
  for (const auth of [undefined, 'Bearer otro']) {
    const res = makeRes();
    await retention(makeReq({ method: 'GET', headers: auth ? { authorization: auth } : {} }), res);
    assert.equal(res.statusCode, 401);
  }
  process.env.CRON_SECRET = '';
  const res = makeRes();
  await retention(makeReq({ method: 'GET', headers: { authorization: 'Bearer ' } }), res);
  assert.equal(res.statusCode, 401, 'sin secreto configurado falla cerrado');
  assert.equal(fetchMock.calls.length, 0);
});

test('24 · cron con CRON_SECRET llama a close_stale_cases (la base cierra, borra descripción y callback)', async () => {
  fetchMock = mockFetch([{ match: (u) => u === `${SUPA}/rest/v1/rpc/close_stale_cases`, reply: () => ({ json: 1 }) }]);
  const res = makeRes();
  await retention(makeReq({ method: 'GET', headers: { authorization: 'Bearer cron-demo' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { closed: 1 });
});
