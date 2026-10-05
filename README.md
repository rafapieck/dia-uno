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

## Lo que te toca hacer a ti, paso a paso

Cada bloque dice **cuándo** hacerlo. Haz solo el bloque que te toca; los siguientes se agregan aquí conforme avancemos.

### Paso A · Publicar en Vercel (toca ahora, después de F0)

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
