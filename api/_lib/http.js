// Respuestas JSON sin caché. Nunca se loguea el cuerpo de las peticiones.

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Lee el JSON del cuerpo sin tronar (Vercel lanza error al leer req.body si el JSON es inválido).
export function readBody(req) {
  let body;
  try {
    body = req.body;
  } catch {
    return null;
  }
  if (body == null) return {};
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString());
    } catch {
      return null;
    }
  }
  return typeof body === 'object' ? body : null;
}

export function bearerToken(req) {
  const header = req.headers?.authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m ? m[1] : null;
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed);
  return send(res, 405, { error: 'method', message: 'Método no permitido.' });
}
