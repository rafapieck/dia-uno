// Pantallas de la víctima. Todo el texto de la víctima se pinta con textContent (nunca innerHTML).
import * as supa from './supa.js';
import { incidentLabel } from './catalog.js';
import { validateCallback } from './phone.js';
import { renderOfficialChannels } from './oficiales.js';
import { checklistFor, SPEI_TEXT } from './checklists.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['v-cargando', 'v-sin-config', 'v-error', 'v-login', 'v-lleno', 'v-relato', 'v-caso', 'v-cierre'];

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

// Checklist: solo si una voluntaria confirmó Y verificó por callback (RLS también lo exige al guardar).
async function renderChecklist(c) {
  const steps = checklistFor(c.incident_type);
  let progress = [];
  try {
    progress = await supa.rest(`checklist_progress?select=step,done&case_id=eq.${c.id}`);
  } catch {
    progress = [];
  }
  const done = new Set(progress.filter((p) => p.done).map((p) => p.step));
  const list = $('checklist');
  list.replaceChildren(
    ...steps.map((step, i) => {
      const n = i + 1;
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = done.has(n);
      const text = document.createElement('span');
      text.textContent = `${n}. ${step.text}`;
      text.classList.toggle('paso-hecho', box.checked);
      box.addEventListener('change', () => saveStep(c.id, n, box, text));
      label.append(box, text);
      li.append(label);
      return li;
    }),
  );
  $('texto-spei').textContent = SPEI_TEXT;
}

async function saveStep(caseId, step, box, text) {
  $('check-error').classList.add('oculto');
  try {
    await supa.rest('checklist_progress?on_conflict=case_id,step', {
      method: 'POST',
      body: { case_id: caseId, step, done: box.checked },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    text.classList.toggle('paso-hecho', box.checked);
  } catch {
    box.checked = !box.checked;
    $('check-error').textContent = 'No pudimos guardar ese paso. Intenta de nuevo.';
    $('check-error').classList.remove('oculto');
  }
}

async function closeCase() {
  const c = currentCase;
  const steps = checklistFor(c.incident_type);
  const doneSteps = [...$('checklist').querySelectorAll('input')]
    .map((box, i) => (box.checked ? steps[i]?.text : null))
    .filter(Boolean);
  const button = $('btn-cerrar');
  button.disabled = true;
  try {
    await supa.rest(`cases?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'closed' }, prefer: 'return=minimal' });
  } catch {
    button.disabled = false;
    $('check-error').textContent = 'No pudimos cerrar tu caso. Intenta de nuevo.';
    $('check-error').classList.remove('oculto');
    return;
  }
  // Resumen: solo pasos hechos y canales oficiales. Nunca un veredicto de seguridad.
  $('cierre-resumen').textContent = `Hiciste ${doneSteps.length} de ${steps.length} pasos:`;
  $('cierre-pasos').replaceChildren(
    ...doneSteps.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }),
  );
  renderOfficialChannels($('cierre-canales'));
  show('v-cierre', { session: true });
}

function renderCase(c) {
  currentCase = c;
  const confirmed = c.status === 'confirmed' && Boolean(c.verified_at);
  $('caso-pendiente').classList.toggle('oculto', confirmed);
  $('caso-confirmado').classList.toggle('oculto', !confirmed);
  $('caso-confirmado-linea').classList.toggle('oculto', !confirmed);
  $('caso-etiqueta-ia').parentElement.classList.toggle('oculto', confirmed);
  $('caso-nota-ia').classList.toggle('oculto', confirmed);
  $('caso-titulo').textContent = confirmed ? 'Tu caso:' : 'Parece que es:';
  $('caso-relato').textContent = c.description;
  const unclassified = !c.incident_type || c.incident_type === 'sin_clasificar';
  $('caso-tipo').textContent = unclassified ? 'Todavía no sabemos qué tipo de caso es' : incidentLabel(c.incident_type);
  $('caso-etiqueta-ia').textContent = c.ai_simulated ? 'IA simulada' : 'Sugerencia de IA';
  $('caso-nota-ia').textContent = unclassified
    ? 'Una voluntaria lo va a revisar y te dirá qué hacer.'
    : 'Es solo una sugerencia. Una voluntaria la va a revisar y puede corregirla.';
  show('v-caso', { session: true });
  if (confirmed) renderChecklist(c);
  else renderCallback(c);
}

async function loadOpenCase() {
  // Filtra por el propio usuario: si también es voluntaria, RLS le deja ver casos de otras personas.
  const me = await supa.getUserId();
  const rows = await supa.rest(
    `cases?select=${CASE_FIELDS}&user_id=eq.${me}&status=neq.closed&order=created_at.desc&limit=1`,
  );
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
$('btn-cerrar').addEventListener('click', closeCase);
$('btn-google').addEventListener('click', () => supa.signInWithGoogle());
$('btn-salir').addEventListener('click', async () => {
  await supa.signOut();
  show('v-login');
});
$('relato').addEventListener('input', updateCounter);
$('form-relato').addEventListener('submit', submitRelato);
for (const b of document.querySelectorAll('[data-accion="recargar"]')) b.addEventListener('click', () => location.reload());

start();
