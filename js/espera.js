// Tiempo de espera en el panel: en rojo si pasa de 30 minutos (meta de la Condición 4).
export const GOAL_MINUTES = 30;

export function waitInfo(createdAt, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  const text = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return { minutes, text, late: minutes > GOAL_MINUTES };
}
