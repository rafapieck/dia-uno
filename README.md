# Día Uno · Primer auxilio digital

App web para que una víctima en México (WhatsApp secuestrado, redes hackeadas, SIM swap, fraude bancario o extorsión) sepa **qué hacer primero**, con un checklist que solo se libera después de que una voluntaria la verifica por callback.

- Fuente de verdad: [`docs/PACKET.md`](docs/PACKET.md)
- Decisiones: [`DECISIONS.md`](DECISIONS.md)
- Stack (gratis): HTML + JS sin frameworks · Vercel (estático + `/api` + Cron) · Supabase (Auth Google + Postgres con RLS) · Gemini free tier · Have I Been Pwned.

**URL pública:** <https://dia-uno.vercel.app>

> **DEMO.** Todo lo simulado está etiquetado en pantalla. Nunca pedimos códigos ni contraseñas.

## Correr local

```bash
cp .env.example .env.local   # llena los valores, nunca lo subas
npm test                      # pruebas sin dependencias (node --test)
npx vercel dev                # app + /api en http://localhost:3000

# Pruebas de RLS en un Postgres local desechable (nunca en Supabase real):
PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run-local.sh
```

## Lo que te toca hacer a ti, paso a paso

Cada bloque dice **cuándo** hacerlo. Haz solo el bloque que te toca; los siguientes se agregan aquí conforme avancemos.

### Paso A · Publicar en Vercel ✅ hecho (2026-10-05) → <https://dia-uno.vercel.app>

Vercel es el servicio gratuito que pone la app en una dirección pública (una URL) que puedes abrir desde el celular.

1. **Crea tu cuenta.** Entra a <https://vercel.com/signup> y elige **Continue with GitHub**. Inicia sesión con la misma cuenta de GitHub donde está el repo `dia-uno`. Si te pregunta el plan, elige **Hobby** (es gratis).
2. **Importa el repo.** En tu panel de Vercel da clic en **Add New… → Project**. Aparece la lista de tus repos de GitHub. Si no ves `dia-uno`, da clic en **Adjust GitHub App Permissions** y dale permiso a ese repo. Luego da clic en **Import** junto a `dia-uno`.
3. **Configura el proyecto.** En la pantalla *Configure Project*:
   - **Framework Preset:** elige **Other**.
   - **Root Directory:** déjalo como está (`./`).
   - **Build and Output Settings:** no cambies nada.
   - **Environment Variables:** por ahora no pongas nada (las llaves se agregan en el Paso B).
4. **Elige la rama.** Por defecto, Vercel publica la rama principal (`main`). Si la rama de trabajo todavía no está unida a `main`, una de dos:
   - une primero el pull request a `main` en GitHub, **o**
   - después de importar, ve a **Deployments**, busca el deploy de la rama `claude/implementation-prompt-follow-gg2j9q` y ábrelo; Vercel crea una URL de vista previa para cada rama.
5. **Publica.** Da clic en **Deploy** y espera ~30 segundos. Cuando veas los confeti, da clic en **Continue to Dashboard**. Tu URL pública aparece en **Domains** (algo como `dia-uno-xxxx.vercel.app`).
6. **Pruébala en tu celular.** Abre esa URL en el celular. **Acepto si:** ves el encabezado verde "Día Uno · Primer auxilio digital", la franja amarilla "Nunca te pediremos tu código ni tu contraseña" (se queda fija arriba al bajar) y la etiqueta naranja DEMO.
7. **Avísame la URL** para anotarla aquí y en `DECISIONS.md`.

A partir de aquí, cada vez que se suba un commit a GitHub, Vercel publica solo (no tienes que repetir estos pasos).

### Paso B · Crear la base de datos en Supabase (toca ahora, después de F1)

Supabase guarda los casos y se encarga del inicio de sesión. Es gratis. Este paso tarda unos 20 minutos.

**B1. Crea tu cuenta y el proyecto**
1. Entra a <https://supabase.com> y da clic en **Start your project**. Elige **Continue with GitHub** (la misma cuenta del repo).
2. Si te pide crear una organización, ponle tu nombre y elige el plan **Free**.
3. Da clic en **New project** y llena:
   - **Name:** `dia-uno`
   - **Database Password:** da clic en **Generate a password** y guárdala en un lugar seguro. Casi no la vas a usar, pero no la pierdas. **Nunca la pegues en el repo ni en el chat.**
   - **Region:** la más cercana a México que aparezca (por ejemplo, una de Estados Unidos).
4. Da clic en **Create new project** y espera 1 o 2 minutos a que diga que está listo.

**B2. Crea las tablas y las reglas de seguridad**
1. En GitHub, abre [`supabase/schema.sql`](supabase/schema.sql) y da clic en el botón **Copy raw file** (el ícono de dos cuadritos arriba a la derecha del archivo).
2. En Supabase, en el menú de la izquierda, entra a **SQL Editor** y da clic en **+ New query** (o **New SQL snippet**).
3. Pega todo el contenido y da clic en **Run** (abajo a la derecha). Si Supabase te advierte que la consulta tiene operaciones "destructivas" (por los `drop ... if exists`), confirma con **Run this query**.
4. Debe decir **Success. No rows returned**.
5. En el menú, entra a **Table Editor**. Debes ver 4 tablas: `callbacks`, `cases`, `checklist_progress` y `volunteers`. Ninguna debe tener la etiqueta roja **RLS disabled** / **Unrestricted**.

**B3. Crea dos usuarios de prueba**
Las pruebas de seguridad necesitan dos víctimas distintas (A y B).
1. En el menú, entra a **Authentication → Users**.
2. Da clic en **Add user → Create new user**.
3. Escribe el correo de tu **primera cuenta de Gmail de prueba** (la víctima A). En contraseña pon una cualquiera larga; no la vas a usar. Deja marcada **Auto Confirm User** y da clic en **Create user**.
4. Repite con tu **segunda cuenta de Gmail** (la víctima B).
   Cuando el login con Google esté listo (F2), esas mismas cuentas entran con Google y Supabase las reconoce por el correo.

**B4. Corre las pruebas de seguridad (9, 20, 21 y 22)**
1. En GitHub, abre [`supabase/tests/rls_test.sql`](supabase/tests/rls_test.sql) y copia todo (**Copy raw file**).
2. En Supabase, entra a **SQL Editor → + New query** y pega.
3. Cerca del inicio cambia `CORREO-VICTIMA-A@gmail.com` y `CORREO-VICTIMA-B@gmail.com` por los dos correos del paso B3. **No cambies nada más.**
4. Da clic en **Run**. El script crea casos de prueba marcados DEMO, intenta "hackear" las reglas desde cada usuario y luego borra lo que creó.
5. Abajo aparece una tabla. **Acepto si:** todas las filas dicen **PASS**. Si alguna dice **FAIL** o sale un error, mándame una captura.
6. (Opcional) Para quitar la tablita de resultados: corre `drop schema rls_prueba cascade;`.

**B5. Avísame** que todo salió PASS. Todavía **no** pongas llaves en Vercel; eso va en el Paso C (F2), junto con el login de Google.
