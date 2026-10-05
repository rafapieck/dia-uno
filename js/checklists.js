// Un checklist por tipo de incidente (PACKET §5, F6). Solo procesos oficiales.
// No inventamos números de teléfono. `todo: true` = paso que Rafael debe validar (TODO: validar).
export const CHECKLISTS = {
  whatsapp: [
    { text: 'Avisa a tus contactos por otro medio (llamada, SMS u otra red) que te robaron el WhatsApp y que no depositen nada.' },
    { text: 'Vuelve a registrar tu número: abre WhatsApp en tu teléfono e inicia sesión otra vez con tu número.', todo: true }, // TODO: validar
    { text: 'El código llega por SMS: escríbelo solo dentro de WhatsApp. No se lo des a nadie, ni a nosotros.' },
    { text: 'Activa la verificación en dos pasos: Ajustes → Cuenta → Verificación en dos pasos.', todo: true }, // TODO: validar
    { text: 'Si no puedes entrar, pide ayuda desde la app: Ajustes → Ayuda → Contáctanos.', todo: true }, // TODO: validar
  ],
  redes: [
    { text: 'Entra a la página oficial de recuperación: facebook.com/hacked o instagram.com/hacked (o la de tu red social).', todo: true }, // TODO: validar
    { text: 'Cambia tu contraseña desde la app oficial (escríbela solo ahí) y cierra la sesión en los otros dispositivos.', todo: true }, // TODO: validar
    { text: 'Revisa que el correo y el teléfono de recuperación sean los tuyos.' },
    { text: 'Activa la verificación en dos pasos en la configuración de seguridad.', todo: true }, // TODO: validar
    { text: 'Avisa a tus contactos por otro medio que no hagan caso a mensajes de tu cuenta.' },
  ],
  sim_swap: [
    { text: 'Desde otro teléfono, llama a tu compañía al número oficial de su sitio o de tu factura. Reporta que te quedaste sin señal y pide bloquear la línea.', todo: true }, // TODO: validar
    { text: 'Llama a tu banco desde otro teléfono, al número que viene atrás de tu tarjeta, y pide bloquear movimientos.' },
    { text: 'Ve con tu identificación a un centro de atención de tu compañía para recuperar tu línea.', todo: true }, // TODO: validar
    { text: 'Cuando recuperes la línea, cambia las contraseñas de tu correo y redes desde sus apps y activa la verificación en dos pasos.' },
    { text: 'Guarda los números de folio que te den.' },
  ],
  fraude: [
    { text: 'ESCALAMIENTO OFICIAL: llama ya a tu banco al número que viene atrás de tu tarjeta o en su app oficial. Pide bloquear la tarjeta y levantar una aclaración. Anota el folio.' },
    { text: 'En la app oficial de tu banco, revisa tus movimientos y desconoce los cargos que no hiciste.' },
    { text: 'Si el banco no te resuelve, presenta una queja ante CONDUSEF (condusef.gob.mx).', todo: true }, // TODO: validar
    { text: 'Presenta una denuncia ante la Fiscalía o la Policía Cibernética de tu estado.', todo: true }, // TODO: validar
    { text: 'Nunca des NIP, códigos ni contraseñas a quien te llame "del banco". El banco no te los pide.' },
  ],
  extorsion: [
    { text: 'ESCALAMIENTO OFICIAL: cuelga. Si hay riesgo para alguien llama al 911; para denunciar, al 089 (denuncia anónima).', todo: true }, // TODO: validar
    { text: 'Antes de pagar nada, comunícate directamente con tu familiar por otro medio.' },
    { text: 'No pagues, no des datos y no devuelvas la llamada a ese número.' },
    { text: 'Anota el número, la hora y lo que te dijeron.' },
    { text: 'Presenta una denuncia ante la Fiscalía de tu estado.', todo: true }, // TODO: validar
  ],
};

export const SPEI_TEXT = 'Nadie puede revertir un SPEI por ti; te guiamos en el proceso oficial.';

export function checklistFor(type) {
  return CHECKLISTS[type] || [];
}
