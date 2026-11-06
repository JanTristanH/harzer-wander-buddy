-- OPERATOR REVIEW ONLY. Apply to isolated staging first, after CAP schema deployment.
-- CAP uses a private server connection. No browser/app Data API access is supported.
BEGIN;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'hwb\_db\_%' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.schemaname, t.tablename);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
  END LOOP;
END $$;
COMMIT;
-- Fail release review if another exposed schema/view/RPC grants access to CAP data.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated', 'PUBLIC') AND table_schema NOT IN ('pg_catalog', 'information_schema');
SELECT n.nspname, p.proname, p.prosecdef, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public';
