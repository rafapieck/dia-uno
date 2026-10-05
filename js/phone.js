// Número para callback: validación en el navegador (la base vuelve a revisar el formato).

// Deja solo dígitos (y un + inicial). "55 1234-5678" → "5512345678"; "+52 (777) 123 4567" → "+527771234567"
export function normalizePhone(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  return text.startsWith('+') ? `+${digits}` : digits;
}

// Los últimos 10 dígitos identifican la línea en México (sin +52 ni 044/045).
function lineKey(phone) {
  return normalizePhone(phone).replace(/\D/g, '').slice(-10);
}

// Regresa { ok, phone } o { ok: false, message }.
export function validateCallback(raw, { simSwap = false, affected = '' } = {}) {
  const phone = normalizePhone(raw);
  const count = phone.replace(/\D/g, '').length;
  if (count < 10 || count > 15) {
    return { ok: false, message: 'Escribe un número de 10 dígitos, por ejemplo 777 123 4567.' };
  }
  if (simSwap) {
    const affectedCount = normalizePhone(affected).replace(/\D/g, '').length;
    if (affectedCount < 10) {
      return { ok: false, message: 'Escribe también tu número afectado (solo para compararlo; no lo guardamos).' };
    }
    if (lineKey(phone) === lineKey(affected)) {
      return {
        ok: false,
        message: 'Ese es el número que te clonaron. Déjanos otro: el de un familiar o un teléfono fijo.',
      };
    }
  }
  return { ok: true, phone };
}
