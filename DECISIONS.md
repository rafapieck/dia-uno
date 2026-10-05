# DECISIONS — Día Uno

Formato: fecha · decisión · por qué.

## 2026-10-05 · Sesión 1

- **F0 · Esqueleto sin build.** HTML + CSS + JS servidos tal cual por Vercel (`cleanUrls`). `package.json` solo existe para `"type": "module"` y `npm test` con `node --test`; cero dependencias. *Por qué:* carga rápida en celulares viejos y nada que mantener.
- **Cabeceras de seguridad en `vercel.json`** (CSP, `X-Frame-Options`, `Referrer-Policy: no-referrer`). La CSP solo permite scripts propios y de `cdn.jsdelivr.net` (cliente de Supabase) y conexiones a `*.supabase.co`.
- **`.env*` en `.gitignore` desde el primer commit**; `.env.example` sin valores.
- **Reparto de trabajo (confirmado por Rafael):** Rafael crea y conecta Vercel y Supabase y carga las llaves; el agente deja en el README los pasos exactos y avisa cuándo toca cada uno.
- **Acciones de la voluntaria solo por `/api` con `service_role`** (confirmado): el límite de casos por voluntaria y el borrado de `callbacks` se validan en el servidor.
- **Números oficiales:** nunca se inventan; cada paso que Rafael deba revisar lleva `TODO: validar`.
- **Se borró `Unknown-1.jpeg`** de la raíz (no lo usaba el PACKET).

## Primer paso de mañana

1. Rafael: Paso A del README (deploy en Vercel) y confirmar la URL en el celular.
2. Agente: F1 — `supabase/schema.sql` con las 4 tablas, RLS y trigger de borrado (borrador listo), más el Paso B del README (crear Supabase y Google Sign-In).
