-- Día Uno · pruebas de RLS y triggers (PACKET §13: 9, 20, 21, 22, y además 8, 23, 24).
--
-- Sirve en dos lugares:
--   · Supabase real: pega TODO en SQL Editor, cambia los dos correos de abajo y da Run.
--     Crea datos de prueba (etiquetados DEMO), corre las pruebas y los borra al final.
--     Al terminar ves una tabla: todas las filas deben decir PASS.
--   · Postgres local: supabase/tests/run-local.sh (usa shim.sql y pone los correos solo).

-- ✏️ CAMBIA ESTOS DOS CORREOS por tus dos cuentas de Google de prueba
--    (cada una debe haber iniciado sesión en la app al menos una vez).
select set_config('dia_uno.email_a', coalesce(nullif(current_setting('dia_uno.email_a', true), ''), 'CORREO-VICTIMA-A@gmail.com'), false);
select set_config('dia_uno.email_b', coalesce(nullif(current_setting('dia_uno.email_b', true), ''), 'CORREO-VICTIMA-B@gmail.com'), false);

-- ── Preparación ──────────────────────────────────────────────────────────
reset role;
drop schema if exists rls_prueba cascade;
create schema rls_prueba;
create table rls_prueba.results (n serial, prueba text, resultado text, detalle text);
grant usage on schema rls_prueba to authenticated, service_role;
grant insert on rls_prueba.results to authenticated, service_role;
grant usage on sequence rls_prueba.results_n_seq to authenticated, service_role;

create function rls_prueba.check(label text, ok boolean, detail text default '') returns void language plpgsql as $$
begin
  insert into rls_prueba.results (prueba, resultado, detalle)
  values (label, case when coalesce(ok, false) then 'PASS' else 'FAIL' end, detail);
  raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, label;
end $$;

-- Pasa si el SQL truena (lo que esperamos de RLS, permisos o triggers).
create function rls_prueba.throws(label text, sql text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    perform rls_prueba.check(label, true, sqlerrm);
    return;
  end;
  perform rls_prueba.check(label, false, 'no truena');
end $$;

-- Cuántas filas tocó un UPDATE/DELETE.
create function rls_prueba.rows(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute sql; get diagnostics n = row_count; return n;
end $$;

grant execute on all functions in schema rls_prueba to authenticated, service_role;

-- Busca el id de un usuario por correo (se corre como postgres, antes de cambiar de rol).
create function rls_prueba.uid(email_setting text) returns uuid language plpgsql as $$
declare u uuid;
begin
  select id into u from auth.users where lower(email) = lower(current_setting(email_setting));
  if u is null then
    raise exception 'No encontré al usuario %. ¿Ya inició sesión con Google en la app?', current_setting(email_setting);
  end if;
  return u;
end $$;

-- Cambia de "quién soy" como lo hace Supabase con el JWT de cada petición.
create function rls_prueba.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims',
    case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, false);
end $$;

-- Ids fijos para los datos de prueba (se borran al final y al inicio de cada corrida).
create function rls_prueba.case_a()   returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function rls_prueba.case_b()   returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function rls_prueba.case_old() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-0000000000b2'::uuid $$;

-- Datos de prueba DEMO (como postgres, igual que desde el SQL Editor)
delete from public.cases where id in (rls_prueba.case_a(), rls_prueba.case_b(), rls_prueba.case_old());
delete from public.volunteers where user_id = rls_prueba.uid('dia_uno.email_b');

insert into public.cases (id, user_id, description, incident_type, urgency) values
  (rls_prueba.case_a(), rls_prueba.uid('dia_uno.email_a'), 'DEMO prueba RLS: me hakearon el wats', 'whatsapp', 'media'),
  (rls_prueba.case_b(), rls_prueba.uid('dia_uno.email_b'), 'DEMO prueba RLS: me clonaron el chip', 'sim_swap', 'alta');
insert into public.cases (id, user_id, description, created_at) values
  (rls_prueba.case_old(), rls_prueba.uid('dia_uno.email_b'), 'DEMO prueba RLS: caso de hace 8 días', now() - interval '8 days');
insert into public.callbacks (case_id, phone) values
  (rls_prueba.case_a(), '5550000001'), (rls_prueba.case_b(), '5550000002'), (rls_prueba.case_old(), '5550000003');

-- ── Como víctima A ───────────────────────────────────────────────────────
select rls_prueba.act_as(rls_prueba.uid('dia_uno.email_a'));
set role authenticated;

-- 9: la víctima no puede leer su propio teléfono de callback
select rls_prueba.check('9   Víctima no puede leer su teléfono de callback',
  (select count(*) from public.callbacks where case_id = rls_prueba.case_a()) = 0);
select rls_prueba.check('9b  Pero sí puede saber que ya lo dejó (has_callback)', public.has_callback(rls_prueba.case_a()));

-- 20: víctima A no ve ni toca el caso de B
select rls_prueba.check('20  A no ve el caso de B',
  (select count(*) from public.cases where id = rls_prueba.case_b()) = 0);
select rls_prueba.check('20b A no ve ningún caso ajeno',
  (select count(*) from public.cases where user_id <> auth.uid()) = 0);
select rls_prueba.check('20c A no puede cerrar el caso de B',
  rls_prueba.rows(format('update public.cases set status = %L where id = %L', 'closed', rls_prueba.case_b())) = 0);
select rls_prueba.check('20d has_callback del caso de B da falso para A', not public.has_callback(rls_prueba.case_b()));
select rls_prueba.throws('20e A no puede dejar callback en el caso de B',
  format('insert into public.callbacks (case_id, phone) values (%L, %L)', rls_prueba.case_b(), '5551112222'));

-- 21: víctima no puede confirmar ni verificar
select rls_prueba.throws('21  A no puede poner status = confirmed',
  format('update public.cases set status = %L where id = %L', 'confirmed', rls_prueba.case_a()));
select rls_prueba.throws('21b A no puede llenar verified_at',
  format('update public.cases set verified_at = now() where id = %L', rls_prueba.case_a()));
select rls_prueba.throws('21c A no puede cambiar incident_type',
  format('update public.cases set incident_type = %L where id = %L', 'fraude', rls_prueba.case_a()));

-- 22: usuario normal no puede hacerse voluntaria
select rls_prueba.throws('22  A no puede insertarse en volunteers',
  format('insert into public.volunteers (user_id, is_coordinator) values (%L, true)', auth.uid()));

-- Extra: los casos solo se crean desde /api (filtro de secretos + capacidad)
select rls_prueba.throws('F1  A no puede crear casos directo (se saltaría el filtro)',
  format('insert into public.cases (user_id, description) values (%L, %L)', auth.uid(), 'DEMO intento directo'));
select rls_prueba.throws('F1  A no puede marcar el checklist sin verificación',
  format('insert into public.checklist_progress (case_id, step, done) values (%L, 1, true)', rls_prueba.case_a()));

reset role;

-- ── B como voluntaria (solo durante la prueba) ───────────────────────────
insert into public.volunteers (user_id, is_coordinator) values (rls_prueba.uid('dia_uno.email_b'), false);
select rls_prueba.act_as(rls_prueba.uid('dia_uno.email_b'));
set role authenticated;

select rls_prueba.check('F1  Voluntaria lee los teléfonos de callback',
  (select count(*) from public.callbacks where case_id in (rls_prueba.case_a(), rls_prueba.case_b(), rls_prueba.case_old())) = 3);
select rls_prueba.check('F1  Voluntaria ve los casos pendientes',
  (select count(*) from public.cases where id in (rls_prueba.case_a(), rls_prueba.case_b(), rls_prueba.case_old())) = 3);
select rls_prueba.throws('22b Voluntaria no puede hacerse coordinadora desde el navegador',
  'update public.volunteers set is_coordinator = true');
select rls_prueba.throws('F1  Voluntaria no puede verificar desde el navegador (solo por /api)',
  format('update public.cases set verified_at = now(), status = %L where id = %L', 'confirmed', rls_prueba.case_a()));

reset role;
delete from public.volunteers where user_id = rls_prueba.uid('dia_uno.email_b');

-- ── Verificación como lo hará /api (service_role) ────────────────────────
select rls_prueba.act_as(null);
set role service_role;
update public.cases set status = 'confirmed', verified_at = now(), confirmed_at = now()
  where id = rls_prueba.case_a();
select rls_prueba.check('8   Al verificar se borra la fila de callbacks',
  not exists (select 1 from public.callbacks where case_id = rls_prueba.case_a()));
reset role;

-- ── Víctima A con su caso ya verificado ──────────────────────────────────
select rls_prueba.act_as(rls_prueba.uid('dia_uno.email_a'));
set role authenticated;

select rls_prueba.check('F1  A ya puede marcar el checklist (confirmed + verified_at)',
  rls_prueba.rows(format('insert into public.checklist_progress (case_id, step, done) values (%L, 1, true)', rls_prueba.case_a())) = 1);

-- 23: al cerrar, descripción [borrado]
select rls_prueba.check('23  A puede cerrar su caso',
  rls_prueba.rows(format('update public.cases set status = %L where id = %L', 'closed', rls_prueba.case_a())) = 1);
select rls_prueba.check('23b Al cerrar, description = [borrado] y closed_at lleno',
  (select description = '[borrado]' and closed_at is not null from public.cases where id = rls_prueba.case_a()));
select rls_prueba.throws('F1  Un caso cerrado no se reabre',
  format('update public.cases set status = %L where id = %L', 'pending', rls_prueba.case_a()));
select rls_prueba.throws('24b Usuario normal no puede correr la retención', 'select public.close_stale_cases()');

reset role;

-- ── 24: retención de 7 días (como el cron, con service_role) ─────────────
select rls_prueba.act_as(null);
set role service_role;
select rls_prueba.check('24  El cron cierra los casos de más de 7 días', public.close_stale_cases() >= 1);
select rls_prueba.check('24c Caso viejo: cerrado y [borrado]',
  (select status = 'closed' and description = '[borrado]' from public.cases where id = rls_prueba.case_old()));
select rls_prueba.check('24d Caso viejo: sin fila en callbacks',
  not exists (select 1 from public.callbacks where case_id = rls_prueba.case_old()));
select rls_prueba.check('24e El caso reciente sigue pendiente',
  (select status = 'pending' and description <> '[borrado]' from public.cases where id = rls_prueba.case_b()));
reset role;

-- ── Limpieza y resultado ─────────────────────────────────────────────────
select rls_prueba.act_as(null);
delete from public.cases where id in (rls_prueba.case_a(), rls_prueba.case_b(), rls_prueba.case_old());

do $$
declare p int; f int;
begin
  select count(*) filter (where resultado = 'PASS'), count(*) filter (where resultado = 'FAIL') into p, f from rls_prueba.results;
  raise notice 'RESUMEN: % pasaron, % fallaron', p, f;
end $$;

select n, prueba, resultado, detalle from rls_prueba.results order by n;
