-- OPERATOR REVIEW ONLY. Apply to isolated staging first, after CAP schema deployment.
-- CAP uses a private server connection. No browser/app Data API access is supported.
-- Verify the real CAP runtime role before applying: table owners/BYPASSRLS roles
-- remain able to access data; a dedicated non-owner needs explicit server-only
-- policies and grants. Do not apply this blindly to a running production service.
BEGIN;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT n.nspname AS schemaname, c.relname AS tablename, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      AND (c.relname LIKE 'hwb\_db\_%' ESCAPE '\' OR c.relname = 'cds_model')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.schemaname, t.tablename);
    IF t.relkind IN ('r', 'p') THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
    END IF;
  END LOOP;
END $$;
COMMIT;
-- Recheck after every CAP deployment. This script deliberately does not change
-- default privileges for unrelated future objects owned by the same DB role.
-- Fail release review if another exposed schema/view/RPC grants access to CAP data.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated', 'PUBLIC') AND table_schema NOT IN ('pg_catalog', 'information_schema');
SELECT n.nspname, p.proname, p.prosecdef, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public';
