// Nombres en español sencillo de los 5 incidentes del catálogo (PACKET §9).
export const INCIDENT_LABELS = {
  whatsapp: 'WhatsApp secuestrado',
  redes: 'Redes sociales hackeadas',
  sim_swap: 'Te clonaron el chip (SIM swap)',
  fraude: 'Fraude bancario',
  extorsion: 'Extorsión',
  sin_clasificar: 'Sin clasificar',
};

export function incidentLabel(type) {
  return INCIDENT_LABELS[type] || INCIDENT_LABELS.sin_clasificar;
}
