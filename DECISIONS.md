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

- **Paso B ✅:** Rafael corrió `rls_test.sql` en Supabase real: 27/27 PASS.

### F2 · Login y relato con filtro de secretos

- **Cero dependencias en el navegador** (confirmado por Rafael): en vez de `supabase-js` desde un CDN, `js/supa.js` (~150 líneas) hace el login con Google por **PKCE** (el token nunca viaja en la URL), renueva la sesión y consulta PostgREST con la llave anon. *Por qué:* nada externo que cargar en celulares viejos y la CSP queda en `script-src 'self'`.
- **Sesión en `localStorage`** (igual que hace `supabase-js`), envuelto en try/catch; la CSP sin scripts externos reduce el riesgo de XSS. El texto de la víctima se pinta siempre con `textContent`.
- **`/api/config`** entrega solo la URL de Supabase y la llave anon (públicas por diseño).
- **`/api/triage` en este orden:** sesión válida (Supabase Auth) → 10–500 caracteres → filtro de secretos → redacción → guardar con `service_role`. El `user_id` sale del token, nunca del cliente. Si hay secreto: 422, sin tocar la base, sin loguear, y la respuesta no repite el dato.
- **Filtro de secretos (`api/_lib/secrets.js`), sin acentos ni mayúsculas:**
  - códigos de 4–8 dígitos cerca (antes o después) de "código / clave / token / verificación";
  - NIP de 4–6; CVV;
  - tarjetas de 13–19 dígitos con Luhn; cualquier corrida de 18 dígitos es CLABE;
  - CURP con estructura oficial (fecha, sexo, estado);
  - contraseñas solo si se escribe el valor ("mi contraseña es X"), no si solo se menciona la palabra.

  Los montos con `$`, "pesos", "mil", etc. no se bloquean.
- **Límite conocido:** un número suelto sin palabra clave ("me llegó 482913") no se bloquea, porque se confundiría con montos escritos sin `$` ("me sacaron 150000"). El banner y la ayuda del formulario piden no escribirlos.
- **Redacción:** correos → `[correo]`, números de 8–13 dígitos → `[teléfono]` (excepto montos).
- **Una sola pantalla de caso abierto:** si la víctima ya tiene un caso sin cerrar, ve ese caso en lugar del formulario.

- **Paso C ✅ (confirmado por Rafael):** el login con Google funciona en <https://dia-uno.vercel.app>. En la URL real, la 15 (código) y la 16 (NIP) se bloquean, la 18 ("hol") pide 10 letras y la 17 ($150,000 pesos) se acepta y crea el caso. Falta probar a mano la tarjeta y la CURP de la 16 (las cubre `npm test`).
- **Llaves de Supabase: legacy (anon y service_role, en formato JWT)**, elegidas por Rafael. `api/_lib/supabase.js` también acepta las nuevas (`sb_publishable_…` / `sb_secret_…`) por si hay que migrar.
- **Segunda cuenta de prueba:** "Entrar con Google" solo funciona si el correo de Outlook es también una cuenta de Google; si no, se usa otra cuenta de Gmail como víctima B.

### F3 · Triage con IA

- **Gemini por REST con `fetch`** (sin SDK), modelo `gemini-2.5-flash` por defecto. La llave va en el header `x-goog-api-key`, nunca en la URL. Hay una variable **opcional** `GEMINI_MODEL` para cambiar de modelo sin tocar código si Google retira ese.
- **Contra la inyección de instrucciones:** el relato va entre `<relato>…</relato>` y se le quitan `<` y `>` para que no pueda cerrar la etiqueta. Las instrucciones de sistema dicen que es un dato y no una orden, y el JSON se pide con `responseSchema` y enums.
- **Validación:** aunque el modelo obedezca la inyección, la respuesta se valida en código contra el catálogo: un tipo fuera de él → `sin_clasificar`; una urgencia fuera de baja/media/alta → `null`.
- **Respaldo "IA simulada":** si no hay llave, hay error, la respuesta no es JSON o no contesta en 8 s, se usan reglas de palabras clave. Soportan escritura coloquial ("wats", "face", "chip", "señal") y van en orden de prioridad: extorsión > SIM swap > WhatsApp > redes > fraude. Se guarda `ai_simulated = true` y la pantalla muestra **IA simulada**.
- **Qué se loguea:** solo el código de error de Gemini o "timeout". Nunca el texto ni la salida del modelo, porque un error de `JSON.parse` podría citarla.
- **En pantalla, la IA es sugerencia:** "Parece que es: …" + etiqueta ("IA simulada" o "Sugerencia de IA") + "una voluntaria la va a revisar y puede corregirla". La urgencia **no** se le muestra a la víctima (sin lenguaje de miedo, §9 Condición 4); es para la voluntaria.
- **Gemini solo recibe el texto redactado** (prueba automática: ni teléfono ni correo llegan a la petición).

- **Paso D, primera vuelta (Rafael):** la prueba 25 pasó (IA simulada sin llave). Con llave, Gemini respondió **404**: Google limita los modelos 2.5 a proyectos que ya los usaban, y recomienda la familia 3.x para proyectos nuevos.
- **Fix: modelo por defecto `gemini-3.5-flash-lite`.** Es estable, de baja latencia y con la cuota gratis más amplia de la familia Flash (3.8 Flash tiene muy pocas peticiones gratis al día). Basta para elegir 1 de 5 tipos.
- **Autodescubrimiento si el modelo se retira:** ante un 404, `/api/triage` pide a Google la lista de modelos (`GET /v1beta/models`, misma llave en el header) y elige el Flash estable más nuevo, prefiriendo Flash-Lite y sin preview, TTS ni imagen. Reintenta una vez y lo recuerda mientras la función siga viva. Si eso también falla → IA simulada.
- **Sin `temperature: 0`:** la guía de Gemini 3 pide dejar la temperatura por defecto; el `responseSchema` con enums ya restringe la salida.
- **Llaves nuevas `AQ.`:** AI Studio ya solo genera este formato. Se mandan igual en el header `x-goog-api-key`; el 404 (y no un 401) confirma que la llave sí fue aceptada.

- **Paso D ✅ (confirmado por Rafael):** prueba 25 (IA simulada sin llave) pasó. Con `GEMINI_API_KEY` y `gemini-3.5-flash-lite`, las pruebas 1, 3, 4, 5 y 19 pasaron y muestran "Sugerencia de IA".

### F4 · Capacidad, "Mientras esperas" y número de callback

- **Regla de capacidad en el servidor (`api/_lib/capacity.js`):** activos (`pending` + `confirmed`) ≥ voluntarias × `MAX_CASES_PER_VOLUNTEER` → no se aceptan casos.
  - `/api/triage` la revisa **antes** de validar el texto y de llamar a la IA, y responde 409 sin crear la fila (prueba 10).
  - `GET /api/capacity` solo responde sí o no, sin cifras del equipo.
  - Con cero voluntarias no hay capacidad: es honesto, porque nadie atendería el caso.
  - Valor inválido en la variable → 5.
- **Carrera aceptada:** dos casos que lleguen al mismo segundo podrían pasar ambos el límite por uno. Para el slice basta; el límite por voluntaria de F5 sí se revalida al tomar el caso.
- **Métrica de la Condición 5:** cada rechazo por capacidad escribe en los logs `triage: caso rechazado por capacidad`, sin datos de la víctima.
- **"Mientras esperas"** es un texto fijo igual para los 5 tipos: no compartas ningún código, no pagues nada, avisa a tus contactos por otro medio. Aparece después de crear el caso y en la pantalla de "estamos al máximo".
- **Pantalla "Hoy estamos al máximo":** mensaje honesto + Mientras esperas + canales oficiales (`js/oficiales.js`). Cada canal sin validar lleva `// TODO: validar` en el código y "(dato por confirmar · DEMO)" en pantalla. No se inventaron números: solo 911, 089, "el número atrás de tu tarjeta" y sitios oficiales.
- **Callback:** la víctima guarda el número directo en `callbacks` (RLS: solo en su caso pendiente, y no puede leerlo después). La app sabe si ya lo dejó con `has_callback()`.
  - Se guarda normalizado (solo dígitos) y la base vuelve a revisar el formato.
  - **SIM swap:** se pide también el número afectado **solo para comparar en el navegador** (no se envía ni se guarda). Si coincide en los últimos 10 dígitos, se rechaza y se pide el de un familiar o un fijo (prueba 2).
- **Pantalla tras guardar:** "Te vamos a llamar desde **DEMO · 000 000 0000**" + etiqueta **Callback simulado** + "contesta solo si te llaman de ese número". Si `callback_failed_at` tiene valor (F5): "Intentamos llamarte; lo vamos a intentar otra vez".
- **Sin alertas (prueba 14):** no hay notificaciones, push, service workers, temporizadores ni envío de SMS, correos o WhatsApp. Una prueba automática revisa el código para que no aparezcan. La víctima solo ve novedades si entra y toca "Ver si ya hay respuesta".
- **Demo:** la cuenta B es la voluntaria y la coordinadora (alta a mano con SQL, como dice §10).

- **Paso E (Rafael):** E1 ✅ (voluntaria dada de alta), E2 ✅ (prueba 2 en la URL real). E3 (prueba 10 en vivo) omitida por tiempo: la segunda cuenta no logra entrar con Google. La cubre `npm test`. `MAX_CASES_PER_VOLUNTEER` regresó a 5.

### F5–F7 · Panel, checklist, cierre y retención (un solo PR, por la entrega de hoy)

- **DEMO: una sola cuenta es víctima y voluntaria/coordinadora** (pedido por Rafael). Ajustes para que funcione:
  - La pantalla de víctima filtra sus casos por `user_id` (del token), porque RLS le deja ver los pendientes de otras personas como voluntaria. Sin ese filtro vería casos ajenos; se comprobó en Postgres local.
  - El panel permite verificar el propio caso y lo marca con **DEMO · Es tu propio caso**. En producción real habría que prohibirlo.
- **Panel `/voluntaria`** (`voluntaria.html` + `js/voluntaria.js`). Solo lo ve quien está en `volunteers` (403 si no). Muestra:
  - descripción, tipo, urgencia, etiqueta de la IA y espera (en rojo si pasa de 30 min);
  - el teléfono para el callback.

  Nunca muestra `user_id`, correo ni nombre de la víctima.
- **Acciones solo por `/api/volunteer/action` con service_role:**
  - `set_type` corrige el tipo y no libera nada (prueba 6).
  - `no_answer` llena `callback_failed_at`, conserva el número y la víctima ve "Intentamos llamarte" (prueba 7).
  - `verified` exige el tipo del catálogo y el número dejado. Revisa el límite de casos activos del dueño (prueba 11) y llena `status = confirmed`, `verified_at`, `confirmed_at` y `owner_id`. Luego borra `callbacks` explícitamente, además del trigger (prueba 8).
  - Fraude y extorsión → dueño = coordinador (prueba 4).
- **HIBP (`/api/breaches`):** solo voluntarias, solo dominios de un catálogo cerrado de plataformas, `User-Agent` propio, sin guardar nada. Siempre trae la nota "no aparecer en brechas conocidas no significa que la cuenta esté a salvo".
- **Checklists (`js/checklists.js`):** de 4 a 5 pasos por tipo, basados en procesos oficiales.
  - WhatsApp empieza como pide el PACKET.
  - En fraude y extorsión, el paso 1 es "ESCALAMIENTO OFICIAL".
  - Los pasos por revisar llevan `// TODO: validar` y `todo: true`. Los únicos números que aparecen son 911 y 089, también por validar.
- **Checklist de la víctima:** solo con `status = confirmed` y `verified_at` lleno. RLS exige lo mismo al guardar `checklist_progress`, que se guarda con upsert. Lleva el texto fijo del SPEI.
- **Cierre:** la víctima cierra su caso por RLS y el trigger pone `[borrado]` (prueba 23). El resumen muestra los pasos hechos y los canales oficiales. Nunca dice "estás a salvo" (prueba 13, revisada en todo el código).
- **Retención (`/api/cron/retention`):** Vercel Cron diario a las 09:00 UTC (`vercel.json`). Exige `Authorization: Bearer CRON_SECRET` (Vercel lo manda solo) y, sin secreto configurado, falla cerrado. Llama a `close_stale_cases()`, que cierra los casos de más de 7 días, y el trigger borra la descripción y el callback (prueba 24, ya probada en Supabase real).
- **Sin confirmación al cerrar:** no se usa `confirm()`, para no tener diálogos ni alertas; el botón es explícito.

## Primer paso de mañana

1. Rafael: Paso F del README (alta de su cuenta como voluntaria/coordinadora, `CRON_SECRET`, flujo completo en la URL real).
2. Agente: F8 — correr las 26 pruebas y anotarlas en `docs/TEST_RESULTS.md`, revisar secretos (prueba 26) y actualizar el README.
2. Agente: F4 — `GET /api/capacity`, pantalla "Mientras esperas" y número de callback (SIM swap: distinto al afectado).
