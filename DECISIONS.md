# DECISIONS — Día Uno

Formato: fecha · decisión · por qué.

## 2026-10-05 · Sesión 1

- **F0 · Esqueleto sin build.** HTML + CSS + JS servidos tal cual por Vercel (`cleanUrls`). `package.json` solo existe para `"type": "module"` y `npm test` con `node --test`; cero dependencias. *Por qué:* carga rápida en celulares viejos y nada que mantener.
- **Cabeceras de seguridad en `vercel.json`** (CSP, `X-Frame-Options`, `Referrer-Policy: no-referrer`). La CSP solo permite scripts propios y de `cdn.jsdelivr.net` (cliente de Supabase) y conexiones a `*.supabase.co`.
- **`.env*` en `.gitignore` desde el primer commit**; `.env.example` sin valores.
