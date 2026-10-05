// Canales oficiales que se muestran cuando estamos al máximo y al cerrar el caso.
// No inventamos números: cada dato lleva `todo` hasta que Rafael lo valide.
export const OFFICIAL_CHANNELS = [
  { name: 'Emergencias (si hay riesgo para alguien)', how: 'Llama al 911', todo: true }, // TODO: validar
  { name: 'Denuncia anónima', how: 'Llama al 089', todo: true }, // TODO: validar
  { name: 'Tu banco', how: 'Llama al número que viene atrás de tu tarjeta o en la app oficial de tu banco', todo: false },
  { name: 'CONDUSEF (quejas contra bancos)', how: 'condusef.gob.mx', todo: true }, // TODO: validar
  { name: 'Policía Cibernética de tu estado', how: 'Busca el sitio oficial de la Secretaría de Seguridad de tu estado', todo: true }, // TODO: validar
  { name: 'WhatsApp', how: 'En la app: Ajustes → Ayuda → Contáctanos', todo: true }, // TODO: validar
  { name: 'Facebook e Instagram', how: 'facebook.com/hacked · instagram.com/hacked', todo: true }, // TODO: validar
  { name: 'Cuenta de Google', how: 'g.co/recover', todo: true }, // TODO: validar
];

export function renderOfficialChannels(list) {
  list.replaceChildren(
    ...OFFICIAL_CHANNELS.map((c) => {
      const li = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = `${c.name}: `;
      li.append(name, c.how);
      if (c.todo) {
        const note = document.createElement('span');
        note.className = 'por-validar';
        note.textContent = ' (dato por confirmar · DEMO)';
        li.append(note);
      }
      return li;
    }),
  );
}
