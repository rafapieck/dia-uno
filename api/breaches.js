// GET /api/breaches?platform=whatsapp — brechas PÚBLICAS conocidas de una plataforma (HIBP).
// Solo por dominio de la plataforma: nunca con el correo o teléfono de la víctima. No se guarda nada.
import { send, methodNotAllowed } from './_lib/http.js';
import { requireVolunteer } from './_lib/volunteer.js';

export const PLATFORMS = {
  whatsapp: ['whatsapp.com'],
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  x: ['twitter.com', 'x.com'],
  google: ['google.com'],
};

export const BREACH_NOTE = 'No aparecer en brechas conocidas no significa que la cuenta esté a salvo.';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  try {
    const auth = await requireVolunteer(req, res);
    if (!auth) return;
    const platform = String(req.query?.platform || new URL(req.url, 'http://x').searchParams.get('platform') || '');
    const domains = PLATFORMS[platform];
    if (!domains) return send(res, 400, { error: 'input', message: 'Plataforma desconocida.' });

    const breaches = [];
    for (const domain of domains) {
      const r = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
        headers: { 'User-Agent': 'Dia-Uno-DEMO (primer auxilio digital)' },
      });
      if (!r.ok) throw Object.assign(new Error('hibp'), { status: r.status });
      for (const b of await r.json()) {
        breaches.push({ title: b.Title, date: b.BreachDate, pwnCount: b.PwnCount, dataClasses: b.DataClasses });
      }
    }
    return send(res, 200, { platform, breaches, note: BREACH_NOTE });
  } catch (err) {
    console.error('breaches: error', err?.status ?? 'error');
    return send(res, 502, { error: 'hibp', message: 'No pudimos consultar las brechas públicas ahora.', note: BREACH_NOTE });
  }
}
