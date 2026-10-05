// Panel de la voluntaria. Todas las acciones van por /api (service_role en el servidor).
import * as supa from './supa.js';
import { waitInfo } from './espera.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['p-cargando', 'p-login', 'p-prohibido', 'p-error', 'p-panel'];
const URGENCY = { alta: 'alta', media: 'media', baja: 'baja' };

function show(view) {
  for (const v of VIEWS) $(v).classList.toggle('oculto', v !== view);
}

function message(text, ok = false) {
  const box = $('p-mensaje');
  box.textContent = text;
  box.className = ok ? 'ok' : 'error';
  box.classList.remove('oculto');
  window.scrollTo(0, 0);
}

async function act(body, okText) {
  const { ok, data } = await supa.api('volunteer/action', { method: 'POST', body });
  if (!ok) {
    message(data.message || 'No se pudo guardar.');
    return false;
  }
  await load();
  message(okText, true);
  return true;
}

function renderCase(c) {
  const node = $('tpl-caso').content.firstElementChild.cloneNode(true);
  const wait = waitInfo(c.created_at);
  const espera = node.querySelector('.espera');
  espera.textContent = `Esperando: ${wait.text}`;
  if (wait.late) {
    node.classList.add('rojo');
    espera.classList.add('espera-roja');
    espera.textContent += ' · pasó la meta de 30 min';
  }
  node.querySelector('.propio').classList.toggle('oculto', !c.own_case);
  node.querySelector('.relato').textContent = c.description;
  node.querySelector('.urgencia').textContent = URGENCY[c.urgency] || 'por revisar';
  node.querySelector('.ia').textContent = c.ai_simulated ? 'IA simulada' : 'Sugerencia de IA';
  const select = node.querySelector('.tipo');
  select.value = c.incident_type || 'sin_clasificar';
  node.querySelector('.telefono').textContent = c.phone
    ? `Llamar a: ${c.phone}`
    : 'La víctima todavía no deja número para el callback.';
  node.querySelector('.fallo').classList.toggle('oculto', !c.callback_failed_at);

  node.querySelector('.btn-tipo').addEventListener('click', () => {
    if (select.value === 'sin_clasificar') return message('Elige uno de los 5 tipos.');
    act({ action: 'set_type', case_id: c.id, incident_type: select.value }, 'Tipo confirmado. Ahora haz el callback.');
  });
  node.querySelector('.btn-verificado').addEventListener('click', async () => {
    if (select.value !== c.incident_type) return message('Primero toca "1 · Confirmar tipo".');
    act({ action: 'verified', case_id: c.id }, 'Callback verificado: la víctima ya ve su checklist.');
  });
  node.querySelector('.btn-nocontesta').addEventListener('click', () =>
    act({ action: 'no_answer', case_id: c.id }, 'Anotado: no contestó. El checklist sigue bloqueado; reintenta más tarde.'),
  );
  return node;
}

async function load() {
  const { ok, status, data } = await supa.api('volunteer/cases');
  if (status === 401) {
    await supa.signOut();
    show('p-login');
    return;
  }
  if (status === 403) return show('p-prohibido');
  if (!ok) {
    $('p-error-texto').textContent = data.message || 'No pudimos cargar el panel.';
    return show('p-error');
  }
  $('p-carga').textContent = `Tus casos activos: ${data.my_active} de ${data.limit}${data.is_coordinator ? ' · Eres coordinador(a)' : ''}`;
  $('p-casos').replaceChildren(...data.cases.map(renderCase));
  $('p-vacio').classList.toggle('oculto', data.cases.length > 0);
  show('p-panel');
}

async function breaches() {
  const list = $('hibp-lista');
  list.replaceChildren();
  const { ok, data } = await supa.api(`breaches?platform=${encodeURIComponent($('hibp-plataforma').value)}`);
  if (data.note) $('hibp-nota').textContent = data.note;
  const items = !ok
    ? [data.message || 'No pudimos consultar ahora.']
    : data.breaches.length
      ? data.breaches.map((b) => `${b.title} (${b.date}): ${b.pwnCount.toLocaleString('es-MX')} cuentas · ${b.dataClasses.slice(0, 4).join(', ')}`)
      : ['No hay brechas públicas conocidas para esta plataforma.'];
  list.replaceChildren(
    ...items.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }),
  );
}

async function start() {
  try {
    await supa.init();
    await supa.handleRedirect();
  } catch {
    $('p-error-texto').textContent = 'No pudimos entrar. Intenta de nuevo.';
    return show('p-error');
  }
  if (!(await supa.getSession())) return show('p-login');
  try {
    await load();
  } catch {
    show('p-error');
  }
}

$('btn-google').addEventListener('click', () => supa.signInWithGoogle());
$('btn-hibp').addEventListener('click', breaches);
for (const b of document.querySelectorAll('[data-accion="recargar"]')) b.addEventListener('click', () => location.reload());

start();
