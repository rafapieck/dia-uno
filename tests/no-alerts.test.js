// PACKET §13 prueba 14 y §9 Condición 4: sin alertas, recordatorios ni cuentas regresivas.
// Revisa que el código del navegador y del servidor no tenga ningún mecanismo para avisar por su cuenta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

function files(dir, exts) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = join(dir, d.name);
    if (d.isDirectory()) return files(rel, exts);
    return exts.some((e) => d.name.endsWith(e)) ? [rel] : [];
  });
}

const CLIENT = [...files('js', ['.js']), 'index.html'];
const SERVER = files('api', ['.js']);

test('14 · el navegador no usa notificaciones, push, service workers, alertas ni temporizadores', () => {
  const forbidden = /Notification|PushManager|serviceWorker|navigator\.vibrate|setInterval|setTimeout|alert\(|confirm\(|<meta[^>]+refresh/;
  for (const f of CLIENT) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, forbidden, `${f} tiene un mecanismo de alerta o temporizador`);
  }
});

test('14 · el servidor no manda SMS, correos, push ni WhatsApp', () => {
  const forbidden = /twilio|sendgrid|nodemailer|resend\.com|mailgun|fcm\.googleapis|web-push|graph\.facebook\.com|whatsapp\.com\/send|api\.whatsapp/i;
  for (const f of SERVER) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, forbidden, `${f} contacta a la víctima por su cuenta`);
  }
});

test('14 · sin lenguaje de cuenta regresiva en la pantalla de la víctima', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /cuenta regresiva|te quedan|últimos minutos|apúrate|urgente/i);
});
