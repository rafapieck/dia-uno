# Día Uno · Primer auxilio digital

App web para que una víctima en México (WhatsApp secuestrado, redes hackeadas, SIM swap, fraude bancario o extorsión) sepa **qué hacer primero**, con un checklist que solo se libera después de que una voluntaria la verifica por callback.

- Fuente de verdad: [`docs/PACKET.md`](docs/PACKET.md)
- Decisiones: [`DECISIONS.md`](DECISIONS.md)
- Stack (gratis): HTML + JS sin frameworks · Vercel (estático + `/api` + Cron) · Supabase (Auth Google + Postgres con RLS) · Gemini free tier · Have I Been Pwned.

> **DEMO.** Todo lo simulado está etiquetado en pantalla. Nunca pedimos códigos ni contraseñas.

## Correr local

```bash
cp .env.example .env.local   # llena los valores, nunca lo subas
npm test                      # pruebas sin dependencias (node --test)
npx vercel dev                # app + /api en http://localhost:3000
```
