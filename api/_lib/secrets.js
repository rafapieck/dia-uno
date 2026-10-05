// Filtro de secretos y redacción (PACKET §9 SHADOW CLAUSE, §12.4).
// Corre en el servidor ANTES de guardar o mandar nada al LLM.
// Nunca loguea el texto: solo regresa qué tipo de secreto encontró.

export const MIN_LEN = 10;
export const MAX_LEN = 500;

export const SECRET_MESSAGE = 'Nunca compartas eso, ni con nosotros.';

const SECRET_LABELS = {
  code: 'un código de verificación',
  password: 'una contraseña',
  nip: 'un NIP',
  cvv: 'un código de seguridad de tarjeta',
  card: 'un número de tarjeta',
  clabe: 'una CLABE',
  curp: 'una CURP',
};

export function secretLabel(kind) {
  return SECRET_LABELS[kind] || 'un dato secreto';
}

// minúsculas y sin acentos: "Contraseña" → "contrasena", "CÓDIGO" → "codigo"
export function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Valida tipo y longitud (10–500) y quita caracteres de control. Regresa el texto limpio.
export function checkDescription(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Cuéntanos qué pasó con tus palabras.' };
  }
  const text = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim();
  const len = [...text].length;
  if (len < MIN_LEN) {
    return { ok: false, message: `Cuéntanos un poco más: escribe al menos ${MIN_LEN} letras.` };
  }
  if (len > MAX_LEN) {
    return { ok: false, message: `Tu mensaje es muy largo. Usa menos de ${MAX_LEN} letras (llevas ${len}).` };
  }
  return { ok: true, text };
}

export function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const AMOUNT_AFTER = /^\s*(pesos|peso|mxn|mil|millones|d[oó]lares|dlls|usd|varos)\b/i;

// Busca un grupo de entre `min` y `max` dígitos que empiece dentro de `window`
// caracteres después de `from`. Ignora montos ($150, 150 pesos, 150,000).
function digitsNear(n, from, window, min, max) {
  const re = /\d(?:[ .-]?\d)*/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(n)) && m.index <= from + window) {
    const before = n.slice(Math.max(0, m.index - 2), m.index);
    const after = n.slice(m.index + m[0].length);
    const isAmount =
      /\$\s?$/.test(before) ||
      /[,.]$/.test(before) ||
      /^[,.]\d/.test(after) ||
      AMOUNT_AFTER.test(after);
    const count = m[0].replace(/\D/g, '').length;
    if (!isAmount && count >= min && count <= max) return true;
  }
  return false;
}

// Busca la palabra clave con dígitos después ("mi codigo es 482913")
// o justo antes ("482913 ese es el codigo").
function keywordNearDigits(n, keywordRe, window, min, max) {
  const re = new RegExp(keywordRe.source, 'g');
  let m;
  while ((m = re.exec(n))) {
    if (digitsNear(n, m.index + m[0].length, window, min, max)) return true;
    const start = Math.max(0, m.index - 25);
    if (digitsNear(n, start, m.index - start, min, max)) return true;
  }
  return false;
}

// Palabras que, después de "mi contraseña es/era", NO son la contraseña.
const PASSWORD_STOPWORDS = new Set([
  'la', 'el', 'lo', 'los', 'las', 'un', 'una', 'mi', 'su', 'tu', 'de', 'del', 'que', 'muy', 'tan', 'mas',
  'y', 'o', 'pero', 'con', 'sin', 'para', 'por', 'no', 'ya', 'me', 'se', 'te', 'le', 'les', 'nos', 'ahora',
  'nunca', 'siempre', 'todavia', 'aun', 'casi', 'como', 'algo', 'esta', 'estaba', 'bien', 'mal',
  'facil', 'dificil', 'segura', 'seguro', 'debil', 'corta', 'larga', 'nueva', 'vieja', 'otra', 'misma',
  'igual', 'diferente', 'distinta', 'parecida', 'sencilla', 'simple', 'mala', 'buena', 'nombre', 'fecha',
  'cambiada', 'cambiado', 'cambiaron', 'robada', 'robado', 'hackeada', 'hackeado', 'hakeada', 'jakeada',
  'borrada', 'bloqueada', 'incorrecta', 'modificada', 'reseteada', 'cambio',
]);

function passwordValue(n) {
  const re = /\b(contrasena|contrasenia|contrasenas|password|passwd|pass|clave|contra)\b\s*(?:de\s+\w+\s*)?(es|era|seria|fue|:|=)\s*["'“”«]?([^\s"'“”»,;]+)/g;
  let m;
  while ((m = re.exec(n))) {
    const value = m[3].replace(/[.!?]+$/, '');
    if (value && !PASSWORD_STOPWORDS.has(value)) return true;
  }
  return false;
}

const CURP_RE =
  /\b[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HMX](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d\b/;

// Regresa el tipo de secreto encontrado ('code', 'password', 'nip', 'cvv', 'card', 'clabe', 'curp') o null.
export function findSecret(text) {
  const n = normalize(text);

  // Tarjetas y CLABE: corridas de 13–19 dígitos (se permiten espacios o guiones sueltos).
  for (const m of n.matchAll(/\d(?:[ -]?\d){12,18}/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 18) return 'clabe';
    if (luhnValid(digits)) return 'card';
  }

  if (CURP_RE.test(n.toUpperCase())) return 'curp';

  if (keywordNearDigits(n, /\b(nip|pin)\b/, 25, 4, 6)) return 'nip';
  if (keywordNearDigits(n, /\b(cvv|cvc|cv2|codigo de seguridad)\b/, 25, 3, 4)) return 'cvv';
  if (
    keywordNearDigits(
      n,
      /\b(codigo|codigos|clave|code|token|otp|verificacion|contrasena dinamica)\b(?!\s*postal)/,
      45,
      4,
      8,
    )
  ) {
    return 'code';
  }
  if (passwordValue(n)) return 'password';

  return null;
}

// Quita correos y teléfonos antes de guardar o mandar al LLM.
export function redact(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/(\$\s?)?\+?\(?\d[\d\s().-]{6,}\d/g, (match, dollar, offset, whole) => {
      if (dollar || AMOUNT_AFTER.test(whole.slice(offset + match.length))) return match;
      const count = match.replace(/\D/g, '').length;
      return count >= 8 && count <= 13 ? '[teléfono]' : match;
    });
}
