#!/usr/bin/env bash
# Synthetic local PostgreSQL only; never accepts a hosted connection string.
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker_local=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
container_name="hwb-cap-isolation-test-$$"
container_id="$("${docker_local[@]}" run -d --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)"
trap '"${docker_local[@]}" rm -fv "$container_id" >/dev/null' EXIT
ready=false
for attempt in {1..30}; do
  if "${docker_local[@]}" exec "$container_id" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Local PostgreSQL did not become ready'; exit 1; }
psql_local=("${docker_local[@]}" exec -i "$container_id" psql -U postgres -v ON_ERROR_STOP=1)
"${psql_local[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.hwb_db_stampings (id integer PRIMARY KEY);
CREATE TABLE public.cds_model (csn text);
CREATE TABLE public.unrelated (id integer);
CREATE VIEW public.hwb_db_stampings_view AS SELECT * FROM public.hwb_db_stampings;
INSERT INTO public.hwb_db_stampings VALUES (1);
INSERT INTO public.cds_model VALUES ('synthetic model');
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
SQL
"${psql_local[@]}" < "$repository_root/backend/hwb/util/secureCapDataApi.sql" >/dev/null
"${psql_local[@]}" >/dev/null <<'SQL'
DO $$
DECLARE role_name text; table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH table_name IN ARRAY ARRAY['hwb_db_stampings', 'cds_model', 'hwb_db_stampings_view'] LOOP
      IF has_table_privilege(role_name, 'public.' || table_name, 'SELECT')
        OR has_table_privilege(role_name, 'public.' || table_name, 'INSERT')
        OR has_table_privilege(role_name, 'public.' || table_name, 'UPDATE')
        OR has_table_privilege(role_name, 'public.' || table_name, 'DELETE') THEN
        RAISE EXCEPTION 'Client access remains for %.%', role_name, table_name;
      END IF;
    END LOOP;
    IF NOT has_table_privilege(role_name, 'public.unrelated', 'SELECT') THEN
      RAISE EXCEPTION 'Unrelated table permissions changed';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_class WHERE relname IN ('hwb_db_stampings', 'cds_model') AND relrowsecurity) <> 2 THEN
    RAISE EXCEPTION 'CAP/model RLS missing';
  END IF;
  IF (SELECT count(*) FROM public.hwb_db_stampings) <> 1 THEN
    RAISE EXCEPTION 'Owner access or existing data changed';
  END IF;
END $$;
SQL
for client_role in anon authenticated; do
  if "${psql_local[@]}" -c "SET ROLE $client_role; SELECT * FROM public.hwb_db_stampings" >/dev/null 2>&1; then
    echo "Unexpected successful client SELECT: $client_role"; exit 1
  fi
done
# Applying the same hardening twice must remain safe.
"${psql_local[@]}" < "$repository_root/backend/hwb/util/secureCapDataApi.sql" >/dev/null
echo 'PASS: CAP tables/model/views deny browser roles; RLS enabled; owner data and unrelated grants preserved; repeat application succeeds.'

# Additional role/view/drift cases; deliberately introduce leaks AFTER the
# original hardening assertions. This is fixture coverage, not a secure end state.
"${psql_local[@]}" < "$repository_root/scripts/fixtures/cap-runtime-roles.sql" >/dev/null
{
  echo 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'
  cat "$repository_root/backend/hwb/util/inspectCapDatabase.sql"
  echo 'ROLLBACK;'
} | "${psql_local[@]}" >/dev/null
echo 'PASS: schema owner / table owner / FORCE / BYPASSRLS, inherited and column grants, alternate view, future-table drift, auth.sessions RLS, read-only inventory.'
