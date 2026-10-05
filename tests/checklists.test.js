// Checklists y textos de cierre · PACKET §13 pruebas 4, 5 (paso 1), 12 (rojo > 30 min) y 13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHECKLISTS, SPEI_TEXT } from '../js/checklists.js';
import { waitInfo } from '../js/espera.js';

const ROOT = new URL('..', import.meta.url).pathname;

test('un checklist de 4–6 pasos para cada uno de los 5 tipos', () => {
  assert.deepEqual(Object.keys(CHECKLISTS).sort(), ['extorsion', 'fraude', 'redes', 'sim_swap', 'whatsapp']);
  for (const [type, steps] of Object.entries(CHECKLISTS)) {
    assert.ok(steps.length >= 4 && steps.length <= 6, type);
  }
});

test('WhatsApp empieza: avisar contactos → volver a registrar → código por SMS a nadie → dos pasos', () => {
  const s = CHECKLISTS.whatsapp.map((x) => x.text);
  assert.match(s[0], /Avisa a tus contactos por otro medio/);
  assert.match(s[1], /Vuelve a registrar tu número/);
  assert.match(s[2], /llega por SMS.*No se lo des a nadie/);
  assert.match(s[3], /verificación en dos pasos/);
});

test('4 · fraude: paso 1 = llamar al banco (escalamiento oficial)', () => {
  assert.match(CHECKLISTS.fraude[0].text, /ESCALAMIENTO OFICIAL.*banco/);
});

test('5 · extorsión: paso 1 = escalamiento oficial', () => {
  assert.match(CHECKLISTS.extorsion[0].text, /ESCALAMIENTO OFICIAL/);
});

test('no se inventan números de teléfono (solo 911 y 089, marcados por validar)', () => {
  for (const steps of Object.values(CHECKLISTS)) {
    for (const s of steps) {
      const numbers = s.text.match(/\d{3,}/g) || [];
      for (const n of numbers) assert.ok(['911', '089'].includes(n), `número inventado: ${n}`);
      if (numbers.length) assert.equal(s.todo, true);
    }
  }
});

test('texto fijo del SPEI', () => {
  assert.equal(SPEI_TEXT, 'Nadie puede revertir un SPEI por ti; te guiamos en el proceso oficial.');
});

test('13 · ningún texto de la app dice "estás a salvo" ni promete recuperar', () => {
  for (const f of ['index.html', 'voluntaria.html', 'js/app.js', 'js/voluntaria.js', 'js/checklists.js', 'js/oficiales.js']) {
    const src = readFileSync(ROOT + f, 'utf8');
    assert.doesNotMatch(src, /est[aá]s a salvo|ya est[aá]s seguro|recuperamos tu cuenta|borramos tus datos filtrados/i, f);
  }
  const html = readFileSync(ROOT + 'voluntaria.html', 'utf8');
  assert.match(html, /No aparecer en brechas conocidas no significa que la cuenta esté a salvo/);
});

test('12 · espera > 30 min se marca en rojo', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  assert.equal(waitInfo('2026-10-05T11:45:00Z', now).late, false);
  assert.equal(waitInfo('2026-10-05T11:30:00Z', now).late, false);
  const late = waitInfo('2026-10-05T11:20:00Z', now);
  assert.equal(late.late, true);
  assert.equal(late.text, '40 min');
  assert.equal(waitInfo('2026-10-05T09:55:00Z', now).text, '2 h 5 min');
});
