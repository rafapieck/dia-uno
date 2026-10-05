// Pantallas de la víctima. Todo el texto de la víctima se pinta con textContent (nunca innerHTML).
import * as supa from './supa.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['v-cargando', 'v-sin-config', 'v-error', 'v-login', 'v-relato', 'v-caso'];

const CASE_FIELDS = 'id,description,incident_type,urgency,status,created_at,verified_at,ai_simulated,callback_failed_at';

function show(view, { session = false } = {}) {
  for (const v of VIEWS) $(v).classList.toggle('oculto', v !== view);
  $('v-sesion').classList.toggle('oculto', !session);
  window.scrollTo(0, 0);
}

function showError(message) {
  if (message) $('error-texto').textContent = message;
  show('v-error');
}

function renderCase(c) {
  $('caso-relato').textContent = c.description;
  show('v-caso', { session: true });
}

async function loadOpenCase() {
  const rows = await supa.rest(`cases?select=${CASE_FIELDS}&status=neq.closed&order=created_at.desc&limit=1`);
  return rows[0] || null;
}

async function start() {
  try {
    await supa.init();
  } catch {
    show('v-sin-config');
    return;
  }

  try {
    await supa.handleRedirect();
  } catch {
    showError('No pudimos entrar con Google. Intenta de nuevo.');
    return;
  }

  const session = await supa.getSession();
  if (!session) {
    show('v-login');
    return;
  }

  try {
    const open = await loadOpenCase();
    if (open) renderCase(open);
    else show('v-relato', { session: true });
  } catch (err) {
    if (err.status === 401) {
      await supa.signOut();
      show('v-login');
    } else {
      showError();
    }
  }
}

function updateCounter() {
  const n = [...$('relato').value].length;
  $('contador').textContent = `${n} de 500 letras`;
}

async function submitRelato(event) {
  event.preventDefault();
  const box = $('relato-error');
  const button = $('btn-enviar');
  box.classList.add('oculto');

  const description = $('relato').value.trim();
  const n = [...description].length;
  if (n < 10 || n > 500) {
    box.textContent = n < 10 ? 'Cuéntanos un poco más: escribe al menos 10 letras.' : `Tu mensaje es muy largo. Usa menos de 500 letras (llevas ${n}).`;
    box.classList.remove('oculto');
    return;
  }

  button.disabled = true;
  button.textContent = 'Enviando…';
  try {
    const { ok, status, data } = await supa.api('triage', { method: 'POST', body: { description } });
    if (ok) {
      $('relato').value = '';
      updateCounter();
      renderCase(data.case);
      return;
    }
    if (status === 401) {
      await supa.signOut();
      show('v-login');
      return;
    }
    box.textContent = data.detail ? `${data.message} ${data.detail}` : data.message || 'No pudimos enviar tu caso. Intenta de nuevo.';
    box.classList.remove('oculto');
    $('relato').focus();
  } catch {
    box.textContent = 'No pudimos enviar tu caso. Revisa tu internet e intenta de nuevo.';
    box.classList.remove('oculto');
  } finally {
    button.disabled = false;
    button.textContent = 'Enviar';
  }
}

$('btn-google').addEventListener('click', () => supa.signInWithGoogle());
$('btn-salir').addEventListener('click', async () => {
  await supa.signOut();
  show('v-login');
});
$('relato').addEventListener('input', updateCounter);
$('form-relato').addEventListener('submit', submitRelato);
for (const b of document.querySelectorAll('[data-accion="recargar"]')) b.addEventListener('click', () => location.reload());

start();
