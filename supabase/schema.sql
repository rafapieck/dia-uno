-- Día Uno · esquema de Supabase (PACKET §11)
-- Córrelo completo en Supabase → SQL Editor. Es idempotente: se puede volver a correr.
-- Las voluntarias se dan de alta a mano (ver el final del archivo).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────

create table if not exists public.volunteers (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  is_coordinator boolean not null default false
);

create table if not exists public.cases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  description        text not null check (char_length(description) between 1 and 600),
  incident_type      text not null default 'sin_clasificar' check (incident_type in
                       ('whatsapp', 'redes', 'sim_swap', 'fraude', 'extorsion', 'sin_clasificar')),
  urgency            text check (urgency in ('baja', 'media', 'alta')),
  status             text not null default 'pending' check (status in ('pending', 'confirmed', 'closed')),
  owner_id           uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  verified_at        timestamptz,
  confirmed_at       timestamptz,
  closed_at          timestamptz,
  -- Extras (ver DECISIONS.md): etiqueta "IA simulada" y aviso de "No contesta".
  ai_simulated       boolean not null default false,
  callback_failed_at timestamptz
);

create index if not exists cases_user_idx   on public.cases (user_id);
create index if not exists cases_status_idx on public.cases (status, created_at);
create index if not exists cases_owner_idx  on public.cases (owner_id) where status = 'confirmed';

create table if not exists public.callbacks (
  case_id uuid primary key references public.cases (id) on delete cascade,
  phone   text not null check (phone ~ '^\+?[0-9]{10,15}$')
);

create table if not exists public.checklist_progress (
  case_id uuid not null references public.cases (id) on delete cascade,
  step    int  not null check (step between 1 and 10),
  done    boolean not null default false,
  primary key (case_id, step)
);

-- ─────────────────────────────────────────────────────────────
-- Funciones auxiliares (security definer para no recursar en RLS)
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_volunteer(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.volunteers v where v.user_id = uid);
$$;

revoke all on function public.is_volunteer(uuid) from public, anon;
grant execute on function public.is_volunteer(uuid) to authenticated, service_role;

-- La víctima no puede leer su teléfono de callback, pero sí saber si ya lo dejó.
create or replace function public.has_callback(p_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.callbacks cb
    join public.cases c on c.id = cb.case_id
    where cb.case_id = p_case_id and c.user_id = auth.uid()
  );
$$;

revoke all on function public.has_callback(uuid) from public, anon;
grant execute on function public.has_callback(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────

-- Antes de actualizar un caso:
--   · desde el navegador (cualquier usuario autenticado) solo se puede pasar status a 'closed';
--     las acciones de la voluntaria van por /api con service_role (auth.uid() es nulo ahí);
--   · un caso cerrado no se reabre;
--   · al cerrar: description = '[borrado]' y closed_at = now().
create or replace function public.cases_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Un caso cerrado no se puede reabrir';
  end if;

  if auth.uid() is not null then
    if new.status <> 'closed'
       or new.user_id       is distinct from old.user_id
       or new.incident_type is distinct from old.incident_type
       or new.urgency       is distinct from old.urgency
       or new.owner_id      is distinct from old.owner_id
       or new.verified_at   is distinct from old.verified_at
       or new.confirmed_at  is distinct from old.confirmed_at
       or new.ai_simulated  is distinct from old.ai_simulated
       or new.callback_failed_at is distinct from old.callback_failed_at
       or new.created_at    is distinct from old.created_at
       or new.description   is distinct from old.description then
      raise exception 'Desde la app solo se puede cerrar el caso';
    end if;
  end if;

  if new.status = 'closed' and old.status <> 'closed' then
    new.description := '[borrado]';
    new.closed_at   := coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists cases_before_update on public.cases;
create trigger cases_before_update
  before update on public.cases
  for each row execute function public.cases_before_update();

-- Después de actualizar: al verificar o al cerrar, se borra el teléfono de callback.
create or replace function public.cases_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status = 'closed' and old.status <> 'closed')
     or (new.verified_at is not null and old.verified_at is null) then
    delete from public.callbacks where case_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists cases_after_update on public.cases;
create trigger cases_after_update
  after update on public.cases
  for each row execute function public.cases_after_update();

-- ─────────────────────────────────────────────────────────────
-- Retención (F7): cierra casos con más de 7 días. Lo llama /api/cron/retention.
-- ─────────────────────────────────────────────────────────────

create or replace function public.close_stale_cases()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.cases
     set status = 'closed'
   where status <> 'closed'
     and created_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.close_stale_cases() from public, anon, authenticated;
grant execute on function public.close_stale_cases() to service_role;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.cases              enable row level security;
alter table public.callbacks          enable row level security;
alter table public.volunteers         enable row level security;
alter table public.checklist_progress enable row level security;

-- Permisos base: el navegador (anon) no toca nada; authenticated solo lo que RLS permita.
revoke all on public.cases, public.callbacks, public.volunteers, public.checklist_progress from anon;
revoke all on public.cases, public.callbacks, public.volunteers, public.checklist_progress from authenticated;
-- Las acciones de la voluntaria (corregir tipo, verificar, asignar dueño, borrar callback)
-- van por /api con service_role, que se salta RLS; por eso aquí no hay permisos de escritura para ellas.
grant select, update (status)  on public.cases to authenticated;
grant select, insert           on public.callbacks to authenticated;
grant select                   on public.volunteers to authenticated;
grant select, insert, update   on public.checklist_progress to authenticated;

-- cases ───────────────────────────────────────────────────────
drop policy if exists cases_victim_select    on public.cases;
drop policy if exists cases_victim_close     on public.cases;
drop policy if exists cases_volunteer_select on public.cases;
drop policy if exists cases_volunteer_update on public.cases;  -- ya no existe: va por /api

-- La víctima lee solo sus casos.
create policy cases_victim_select on public.cases
  for select to authenticated
  using (user_id = auth.uid());

-- La víctima solo puede pasar status a 'closed' (el trigger bloquea cualquier otra columna).
create policy cases_victim_close on public.cases
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'closed');

-- La voluntaria lee casos pending/confirmed.
create policy cases_volunteer_select on public.cases
  for select to authenticated
  using (public.is_volunteer(auth.uid()) and status in ('pending', 'confirmed'));

-- Sin política de INSERT para authenticated: los casos solo se crean desde /api/triage
-- (service_role), después del filtro de secretos y de la regla de capacidad.

-- callbacks ───────────────────────────────────────────────────
drop policy if exists callbacks_victim_insert    on public.callbacks;
drop policy if exists callbacks_volunteer_select on public.callbacks;
drop policy if exists callbacks_volunteer_delete on public.callbacks;  -- ya no existe: va por /api

-- La víctima solo inserta el teléfono de su propio caso abierto y sin verificar. No hay SELECT para ella.
create policy callbacks_victim_insert on public.callbacks
  for insert to authenticated
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id and c.user_id = auth.uid()
      and c.status = 'pending' and c.verified_at is null
  ));

-- Solo las voluntarias lo leen (el panel lo lee por /api; esta política es la red de seguridad).
create policy callbacks_volunteer_select on public.callbacks
  for select to authenticated
  using (public.is_volunteer(auth.uid()));

-- volunteers ──────────────────────────────────────────────────
drop policy if exists volunteers_self_select on public.volunteers;

-- Cada quien solo ve su propia fila (para saber si es voluntaria). Nadie inserta desde el cliente.
create policy volunteers_self_select on public.volunteers
  for select to authenticated
  using (user_id = auth.uid());

-- checklist_progress ──────────────────────────────────────────
drop policy if exists progress_victim_select on public.checklist_progress;
drop policy if exists progress_victim_insert on public.checklist_progress;
drop policy if exists progress_victim_update on public.checklist_progress;

create policy progress_victim_select on public.checklist_progress
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

create policy progress_victim_insert on public.checklist_progress
  for insert to authenticated
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id and c.user_id = auth.uid()
      and c.status = 'confirmed' and c.verified_at is not null
  ));

create policy progress_victim_update on public.checklist_progress
  for update to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id and c.user_id = auth.uid()
      and c.status = 'confirmed' and c.verified_at is not null
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id and c.user_id = auth.uid()
      and c.status = 'confirmed' and c.verified_at is not null
  ));

-- ─────────────────────────────────────────────────────────────
-- Alta de voluntarias (a mano, desde el SQL Editor):
--   insert into public.volunteers (user_id, is_coordinator)
--   select id, false from auth.users where email = 'ana@ejemplo.com';
--   -- coordinador:
--   insert into public.volunteers (user_id, is_coordinator)
--   select id, true from auth.users where email = 'coordinador@ejemplo.com';
-- ─────────────────────────────────────────────────────────────
