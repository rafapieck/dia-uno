// Número de callback · PACKET §13 prueba 2 (pide un número distinto al afectado en SIM swap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCallback, normalizePhone } from '../js/phone.js';

test('normaliza espacios, guiones y paréntesis', () => {
  assert.equal(normalizePhone('55 1234-5678'), '5512345678');
  assert.equal(normalizePhone('+52 (777) 123 4567'), '+527771234567');
});

test('número válido de 10 dígitos', () => {
  assert.deepEqual(validateCallback('777 123 4567'), { ok: true, phone: '7771234567' });
});

test('número corto o largo → mensaje claro', () => {
  assert.equal(validateCallback('12345').ok, false);
  assert.match(validateCallback('12345').message, /10 dígitos/);
  assert.equal(validateCallback('1'.repeat(16)).ok, false);
});

test('2 · SIM swap: el mismo número afectado se rechaza (aunque venga con +52 o espacios)', () => {
  const r = validateCallback('+52 777 123 4567', { simSwap: true, affected: '7771234567' });
  assert.equal(r.ok, false);
  assert.match(r.message, /familiar o un teléfono fijo/);
});

test('2 · SIM swap: pide el número afectado para comparar', () => {
  const r = validateCallback('7771234567', { simSwap: true, affected: '' });
  assert.equal(r.ok, false);
  assert.match(r.message, /número afectado/);
});

test('2 · SIM swap: un número distinto se acepta', () => {
  assert.deepEqual(validateCallback('777 765 4321', { simSwap: true, affected: '777 123 4567' }), {
    ok: true,
    phone: '7777654321',
  });
});

test('sin SIM swap no se pide número afectado', () => {
  assert.equal(validateCallback('7771234567', { simSwap: false }).ok, true);
});
