# IMPLEMENTATION PROMPT — Día Uno · Week 8

> Pega todo este archivo en tu agente de código (Claude Code o Codex CLI), abierto dentro del repo `dia-uno`.

---

Eres mi agente de código. Vamos a construir **Día Uno**, el slice descrito en `docs/PACKET.md`. Ese archivo es la fuente de verdad: léelo completo antes de escribir código. Si algo de aquí contradice al PACKET, gana el PACKET; si necesitas desviarte de él, **pregúntame primero**.

## Reglas para toda la sesión

1. **Solo stack gratuito:** HTML + JavaScript sin frameworks, Vercel (estático + `/api` serverless + Cron), Supabase (Auth con Google + Postgres con RLS), Gemini API free tier, Have I Been Pwned (endpoint público de brechas).
2. **Security floor primero, no al final.** Nunca escribas llaves en el código. `.env*` va en `.gitignore` desde el primer commit. La `service_role` de Supabase solo se usa en `/api`, nunca en el navegador.
3. **Todo lo simulado se etiqueta en pantalla:** clasificación de IA de respaldo ("IA simulada"), callback ("Callback simulado"), número publicado (`DEMO · 000 000 0000`) y casos de demo ("DEMO").
4. **Prohibido:** antivirus, gestor de contraseñas, "recuperación automática", WhatsApp Business API, notificaciones push/SMS, consultar el correo o teléfono de la víctima en HIBP, guardar datasets de brechas.
5. **Un feature = un commit pequeño** con mensaje claro (`feat:`, `fix:`, `test:`, `docs:`). Al terminar cada feature, corre sus pruebas (los números son los del plan de pruebas, sección 13 del PACKET) y dime cuáles pasaron.
6. **Textos de la app en español sencillo**, letra grande, alto contraste, pensado para Don Beto (58, lee despacio). Debe verse bien a 360 px de ancho.
7. **Cierre de sesión:** al final de cada sesión actualiza `DECISIONS.md` (qué decidimos y por qué), escribe el primer paso de mañana, haz commit y push.

## Variables de entorno (en Vercel y en `.env.local`, nunca en el repo)

`SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `GEMINI_API_KEY` · `MAX_CASES_PER_VOLUNTEER=5` · `CRON_SECRET`

Crea un `.env.example` con los nombres, sin valores.

## Features, en orden

### F0 — Esqueleto y primer deploy
- `index.html`, `vercel.json`, `.gitignore` (con `.env*`), `README.md` corto, `DECISIONS.md`.
- Pantalla inicial con el header "Día Uno · Primer auxilio digital", el **banner amarillo fijo** "Nunca te pediremos tu código ni tu contraseña" y la etiqueta DEMO.
- **Acepto si:** la URL pública de Vercel carga en el celular y el banner se ve.
- **Commit 1** → **Deploy 1**.

### F1 — Base de datos y RLS
- `supabase/schema.sql` con las 4 tablas de la sección 11 del PACKET: `cases`, `callbacks`, `volunteers`, `checklist_progress`.
- RLS activado en las 4 con las reglas de la sección 11.
- Trigger: al pasar `cases.status` a `closed`, `description = '[borrado]'` y se borra la fila de `callbacks`.
- **Acepto si:** pasan las pruebas 9, 20, 21 y 22 (hazlas con dos usuarios de prueba).
- **Commit 2.**

### F2 — Login y relato con filtro de secretos
- Login con Google (Supabase Auth). Sin sesión no se puede crear ni ver casos.
- Formulario "¿Qué pasó?" → `POST /api/triage`.
- En el servidor, en este orden: longitud de 10–500 caracteres → **filtro de secretos** (códigos de verificación, contraseñas, NIP, tarjetas con chequeo Luhn, CLABE de 18 dígitos, CURP; insensible a acentos; los montos con `$` o "pesos" **no** se bloquean) → redacción de teléfonos y correos.
- Si el filtro detecta algo: responde con el mensaje "Nunca compartas eso, ni con nosotros", **sin guardar nada y sin loguear el cuerpo**.
- **Acepto si:** pasan las pruebas 15, 16, 17 y 18.
- **Commit 3.**

### F3 — Triage con IA
- `/api/triage` manda el texto ya filtrado y redactado a Gemini, delimitado como dato y no como instrucción. Pide JSON con `incident_type` (solo uno de los 5) y `urgency` (baja/media/alta).
- Valida la respuesta contra el catálogo. Si no coincide, queda como "sin clasificar".
- Sin llave o con error: clasificación simulada por palabras clave, con la etiqueta visible "IA simulada".
- En la pantalla, la IA aparece como **sugerencia**, nunca como veredicto.
- **Acepto si:** pasan las pruebas 1, 3, 4, 5, 19 y 25.
- **Commit 4.**

### F4 — Capacidad, "Mientras esperas" y número de callback
- `GET /api/capacity`: si los casos activos ≥ voluntarias × `MAX_CASES_PER_VOLUNTEER`, la app **no deja crear casos** y muestra un mensaje honesto con "Mientras esperas" y los canales oficiales.
- Tras crear el caso: pantalla "Mientras esperas" (texto fijo para los 5 tipos) y campo para el número de callback, que se guarda en `callbacks`. Si es SIM swap, se pide un número **distinto** al afectado.
- Sin alertas, recordatorios ni cuentas regresivas.
- **Acepto si:** pasan las pruebas 2, 10 y 14.
- **Commit 5.**

### F5 — Panel de la voluntaria
- Ruta `/voluntaria`, visible solo para usuarios en `volunteers`.
- Lista de casos pendientes con el tiempo de espera; en **rojo** si pasan de 30 min. Muestra descripción, tipo y urgencia, **nunca** el correo ni el nombre de la víctima.
- Acciones: confirmar o corregir el tipo; luego "Callback verificado" o "No contesta" (etiquetado "Callback simulado").
- Al verificar: se llena `verified_at` y `confirmed_at`, se asigna `owner_id` y se borra la fila de `callbacks`. Fraude y extorsión se asignan al coordinador (`is_coordinator`).
- Límite de casos activos por voluntaria.
- Brechas públicas de la plataforma afectada vía `/api/breaches` (HIBP por plataforma, con `User-Agent`), con la nota "no aparecer no significa estar a salvo".
- **Acepto si:** pasan las pruebas 6, 7, 8, 11 y 12.
- **Commit 6** → **Deploy 2**.

### F6 — Checklist, escalamiento y cierre
- Un checklist por tipo de incidente, de 4–6 pasos, en `checklists.js`. Básalos solo en procesos oficiales (WhatsApp, Meta, Google, tu banco, CONDUSEF, líneas de denuncia). **No inventes números de teléfono**; marca con `TODO: validar` cada paso que yo deba revisar.
- WhatsApp secuestrado empieza así: avisar a contactos por otro medio → volver a registrar el número → el código llega por SMS y no se le da a nadie → activar verificación en dos pasos.
- Fraude bancario y extorsión: el paso 1 es el escalamiento oficial.
- Solo se ve si `status = 'confirmed'` y `verified_at` no es nulo; la víctima marca pasos en `checklist_progress`.
- Texto fijo: "Nadie puede revertir un SPEI por ti; te guiamos en el proceso oficial".
- Cierre: resumen de pasos hechos y canales oficiales; **nunca** "estás a salvo".
- **Acepto si:** pasan las pruebas 13 y 23.
- **Commit 7.**

### F7 — Retención automática
- `/api/cron/retention` protegido con `CRON_SECRET`, programado una vez al día en `vercel.json`: cierra los casos con más de 7 días y borra su descripción y su callback.
- **Acepto si:** pasa la prueba 24.
- **Commit 8** → **Deploy 3**.

### F8 — Pasada final
- Corre las 26 pruebas del PACKET y anota los resultados en `docs/TEST_RESULTS.md`.
- Revisa secretos con `git grep -i -E "key|secret|token"` y `git log -p` (prueba 26).
- Actualiza `README.md` con la URL pública y cómo probar como víctima y como voluntaria.
- **Commit 9.**

## Empieza así

1. Lee `docs/PACKET.md` completo.
2. Dime en 5 líneas qué entendiste y qué dudas tienes.
3. Espera mi "va" y arranca con F0.
