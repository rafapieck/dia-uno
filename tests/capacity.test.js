// GET /api/capacity · PACKET §13 prueba 10.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/capacity.js';
import { maxCasesPerVolunteer } from '../api/_lib/capacity.js';
import { makeReq, makeRes, setEnv, mockFetch, authRoute, capacityRoutes } from './helpers.js';

let fetchMock;
let state;

beforeEach(() => {
  setEnv();
  state = { active: 0, volunteers: 2 };
  fetchMock = mockFetch([authRoute, ...capacityRoutes(state)]);
});

afterEach(() => fetchMock.restore());

async function get(token = 'tok-a') {
  const res = makeRes();
  await handler(makeReq({ method: 'GET', token }), res);
  return res;
}

test('hay lugar: 9 activos con 2 voluntarias × 5 → abierto, sin exponer cifras', async () => {
  state.active = 9;
  const res = await get();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { open: true });
});

test('al máximo: 10 activos con 2 voluntarias × 5 → cerrado con mensaje honesto', async () => {
  state.active = 10;
  const res = await get();
  assert.equal(res.body.open, false);
  assert.match(res.body.message, /al máximo/);
  assert.equal(res.body.active, undefined);
});

test('10 · bajar el límite a 1: 1 voluntaria con 1 caso activo → cerrado', async () => {
  process.env.MAX_CASES_PER_VOLUNTEER = '1';
  state.volunteers = 1;
  state.active = 1;
  const res = await get();
  assert.equal(res.body.open, false);
});

test('solo cuenta casos activos (pending y confirmed)', async () => {
  await get();
  const casesCall = fetchMock.calls.find((c) => c.url.includes('/rest/v1/cases?'));
  assert.match(decodeURIComponent(casesCall.url), /status=in\.\(pending,confirmed\)/);
});

test('sin sesión → 401', async () => {
  const res = await get(null);
  assert.equal(res.statusCode, 401);
});

test('MAX_CASES_PER_VOLUNTEER inválido o vacío → 5', () => {
  process.env.MAX_CASES_PER_VOLUNTEER = 'abc';
  assert.equal(maxCasesPerVolunteer(), 5);
  process.env.MAX_CASES_PER_VOLUNTEER = '0';
  assert.equal(maxCasesPerVolunteer(), 5);
  process.env.MAX_CASES_PER_VOLUNTEER = '3';
  assert.equal(maxCasesPerVolunteer(), 3);
});
