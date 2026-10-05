#!/usr/bin/env bash
# Corre schema.sql + rls_test.sql en un Postgres LOCAL desechable (nunca en Supabase real).
# Uso: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=dia_uno_test
q() { psql -q -X -v ON_ERROR_STOP=1 "$@"; }

q -d postgres -c "drop database if exists $DB" -c "create database $DB" 2>/dev/null
q -d "$DB" -f shim.sql
q -d "$DB" -f ../schema.sql 2>&1 | grep -v "does not exist, skipping" || true
q -d "$DB" -c "insert into auth.users (email) values ('victima-a@demo.test'), ('victima-b@demo.test')"

# Solo se imprimen los avisos PASS/FAIL y el resumen.
PGOPTIONS="-c dia_uno.email_a=victima-a@demo.test -c dia_uno.email_b=victima-b@demo.test" \
  q -d "$DB" -o /dev/null -f rls_test.sql 2>&1 | sed "s/^psql:[^ ]* //"

fails=$(q -At -d "$DB" -c "select count(*) from rls_prueba.results where resultado = 'FAIL'")
q -d postgres -c "drop database $DB"
[ "$fails" = "0" ]
