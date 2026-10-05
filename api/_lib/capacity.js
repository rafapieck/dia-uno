// Regla de capacidad (PACKET §9 Condición 4): si los casos activos llegan a
// voluntarias × MAX_CASES_PER_VOLUNTEER, no se aceptan casos nuevos.
import { dbCount } from './supabase.js';

export function maxCasesPerVolunteer() {
  const n = Number.parseInt(process.env.MAX_CASES_PER_VOLUNTEER || '5', 10);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}

export async function getCapacity() {
  const [active, volunteers] = await Promise.all([
    dbCount('cases?select=id&status=in.(pending,confirmed)'),
    dbCount('volunteers?select=user_id'),
  ]);
  const limit = volunteers * maxCasesPerVolunteer();
  return { open: active < limit, active, limit };
}

export const CAPACITY_MESSAGE =
  'Hoy estamos al máximo. Nuestras voluntarias ya tienen todos los casos que pueden atender bien, así que por ahora no podemos recibir el tuyo.';
