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
- **Flujo de GitHub (pedido por Rafael):** al terminar cada feature, el agente abre un pull request de su rama a `main` y lo une él mismo, para que `main` siempre tenga lo último. Vercel publica `main`.
- **Deploy 1 ✅:** <https://dia-uno.vercel.app> carga en el celular con header, banner amarillo y DEMO (confirmado por Rafael).

### F1 · Base de datos y RLS

- **`supabase/schema.sql` idempotente** (se puede volver a correr): 4 tablas de §11, RLS en las 4, triggers y la función de retención que usará F7.
- **Más estricto que §11 en la creación de casos:** la víctima **no** tiene permiso de INSERT en `cases`; los casos solo se crean desde `/api/triage` con `service_role`. *Por qué:* si el navegador pudiera insertar directo, se saltaría el filtro de secretos y la regla de capacidad. La víctima sigue viendo solo sus filas (`user_id = auth.uid()`).
- **Voluntaria: solo lectura desde el navegador.** Sus escrituras (tipo, verificación, dueño, borrar callback) van por `/api` con `service_role`, como acordamos; por eso no hay política de UPDATE para voluntarias.
- **"Solo puede cambiar `status` a `closed`"** se cumple con tres capas: permiso de columna (`grant update (status)`), política (`with check status = 'closed'`) y un trigger que rechaza cualquier otro cambio hecho desde la app. Un caso cerrado no se reabre.
- **Borrado:** al cerrar, el trigger pone `description = '[borrado]'` y `closed_at`, y borra `callbacks`. También borra `callbacks` en cuanto se llena `verified_at` (red de seguridad por si `/api` falla a medias).
- **`has_callback(case_id)`:** la víctima no puede leer su teléfono (prueba 9), pero la app necesita saber si ya lo dejó; esta función solo responde sí o no y solo para casos propios.
- **Dos columnas extra en `cases`:** `ai_simulated` (para mostrar la etiqueta "IA simulada") y `callback_failed_at` (para que la víctima vea "no pudimos contactarte" sin leer `callbacks`). No exponen datos de la víctima.
- **Pruebas de RLS automatizadas:** `supabase/tests/rls_test.sql` sirve igual en Supabase real (con 2 usuarios de prueba, limpia al final) y en un Postgres local con `shim.sql` (imita `auth.uid()` y los roles de Supabase). Control negativo: si se afloja una política, la prueba correspondiente da FAIL.

## Primer paso de mañana

1. Rafael: Paso B del README (crear Supabase, correr `schema.sql`, crear 2 usuarios y correr `rls_test.sql`); confirmar que todo da PASS.
2. Agente: F2 — login con Google y `POST /api/triage` con filtro de secretos, más el Paso C del README (Google Sign-In y llaves en Vercel).
