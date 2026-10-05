-- Imitación mínima de Supabase para correr schema.sql en un Postgres local de pruebas.
-- ⚠️ Solo para una base desechable. Nunca lo corras en tu proyecto real de Supabase.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Igual que en Supabase: auth.uid() sale del JWT de la petición (aquí, de una variable de sesión).
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase da todo a estos roles por defecto en tablas y funciones nuevas de public.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
