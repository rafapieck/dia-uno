// Pantallas de la víctima. Todo el texto de la víctima se pinta con textContent (nunca innerHTML).
import * as supa from './supa.js';
import { incidentLabel } from './catalog.js';
import { validateCallback } from './phone.js';
import { renderOfficialChannels } from './oficiales.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['v-cargando', 'v-sin-config', 'v-error', 'v-login', 'v-lleno', 'v-relato', 'v-caso'];

let currentCase = null;

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

// El texto de "estamos al máximo" es fijo en la página (el título ya lo dice; no repetimos el del servidor).
function showFull() {
  renderOfficialChannels($('lleno-canales'));
  show('v-lleno', { session: true });
}

// Tarjeta del callback: formulario, "te vamos a llamar" o "intentamos llamarte".
async function renderCallback(c) {
  for (const id of ['form-callback', 'cb-listo', 'cb-fallo']) $(id).classList.add('oculto');
  if (c.status !== 'pending') return;
  if (c.callback_failed_at) $('cb-fallo').classList.remove('oculto');
  let saved = false;
  try {
    saved = await supa.rest('rpc/has_callback', { method: 'POST', body: { p_case_id: c.id } });
  } catch {
    saved = false;
  }
  if (saved) {
    $('cb-listo').classList.remove('oculto');
    return;
  }
  const simSwap = c.incident_type === 'sim_swap';
  $('cb-sim').classList.toggle('oculto', !simSwap);
  $('cb-telefono-label').textContent = simSwap ? 'Número de un familiar o teléfono fijo' : 'Número para llamarte';
  $('form-callback').classList.remove('oculto');
}

function renderCase(c) {
  currentCase = c;
  $('caso-relato').textContent = c.description;
  const unclassified = !c.incident_type || c.incident_type === 'sin_clasificar';
  $('caso-tipo').textContent = unclassified ? 'Todavía no sabemos qué tipo de caso es' : incidentLabel(c.incident_type);
  $('caso-etiqueta-ia').textContent = c.ai_simulated ? 'IA simulada' : 'Sugerencia de IA';
  $('caso-nota-ia').textContent = unclassified
    ? 'Una voluntaria lo va a revisar y te dirá qué hacer.'
    : 'Es solo una sugerencia. Una voluntaria la va a revisar y puede corregirla.';
  show('v-caso', { session: true });
  renderCallback(c);
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
    if (open) {
      renderCase(open);
      return;
    }
    const capacity = await supa.api('capacity');
    if (capacity.status === 401) throw Object.assign(new Error('auth'), { status: 401 });
    if (capacity.ok && capacity.data.open === false) showFull();
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
    if (status === 409 && data.error === 'capacity') {
      showFull();
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

async function submitCallback(event) {
  event.preventDefault();
  const box = $('cb-error');
  const button = $('btn-callback');
  box.classList.add('oculto');
  const check = validateCallback($('cb-telefono').value, {
    simSwap: currentCase?.incident_type === 'sim_swap',
    affected: $('cb-afectado').value,
  });
  if (!check.ok) {
    box.textContent = check.message;
    box.classList.remove('oculto');
    return;
  }
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    await supa.rest('callbacks', {
      method: 'POST',
      body: { case_id: currentCase.id, phone: check.phone },
      prefer: 'return=minimal',
    });
    $('cb-telefono').value = '';
    $('cb-afectado').value = '';
    renderCallback(currentCase);
  } catch (err) {
    box.textContent =
      err.status === 409
        ? 'Ya tenemos un número para este caso.'
        : 'No pudimos guardar el número. Revisa tu internet e intenta de nuevo.';
    box.classList.remove('oculto');
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar número';
  }
}

$('form-callback').addEventListener('submit', submitCallback);
$('btn-google').addEventListener('click', () => supa.signInWithGoogle());
$('btn-salir').addEventListener('click', async () => {
  await supa.signOut();
  show('v-login');
});
$('relato').addEventListener('input', updateCounter);
$('form-relato').addEventListener('submit', submitRelato);
for (const b of document.querySelectorAll('[data-accion="recargar"]')) b.addEventListener('click', () => location.reload());

start();
