-- Synthetic regression extension, only in the disposable local test database.
CREATE ROLE cap_schema_owner NOLOGIN;
CREATE ROLE cap_owner NOLOGIN;
CREATE ROLE cap_plain NOLOGIN;
CREATE ROLE cap_bypass NOLOGIN BYPASSRLS;
CREATE ROLE cap_parent NOLOGIN;
CREATE ROLE cap_child NOLOGIN INHERIT IN ROLE cap_parent;
CREATE SCHEMA cap_role_test AUTHORIZATION cap_schema_owner;
GRANT USAGE ON SCHEMA cap_role_test TO cap_plain,cap_bypass,cap_owner;
CREATE TABLE cap_role_test.records(id integer);
ALTER TABLE cap_role_test.records OWNER TO cap_owner;
INSERT INTO cap_role_test.records VALUES (1);
GRANT SELECT ON cap_role_test.records TO cap_plain,cap_bypass,cap_schema_owner;
ALTER TABLE cap_role_test.records ENABLE ROW LEVEL SECURITY;
SET ROLE cap_plain;
DO $$ BEGIN
 IF (SELECT count(*) FROM cap_role_test.records)<>0 OR NOT row_security_active('cap_role_test.records') THEN
 RAISE EXCEPTION 'Ordinary runtime must be filtered without policies'; END IF;
END $$;
RESET ROLE;
SET ROLE cap_schema_owner;
DO $$ BEGIN
 IF (SELECT count(*) FROM cap_role_test.records)<>0 THEN
 RAISE EXCEPTION 'Schema ownership must not bypass table RLS'; END IF;
END $$;
RESET ROLE;
SET ROLE cap_bypass;
DO $$ BEGIN
 IF (SELECT count(*) FROM cap_role_test.records)<>1 OR row_security_active('cap_role_test.records') THEN
 RAISE EXCEPTION 'BYPASSRLS with SELECT should retain rows'; END IF;
END $$;
RESET ROLE;
SET ROLE cap_owner;
DO $$ BEGIN
 IF (SELECT count(*) FROM cap_role_test.records)<>1 THEN RAISE EXCEPTION 'Owner lost access'; END IF;
END $$;
RESET ROLE;
ALTER TABLE cap_role_test.records FORCE ROW LEVEL SECURITY;
SET ROLE cap_owner;
DO $$ BEGIN
 IF (SELECT count(*) FROM cap_role_test.records)<>0 THEN RAISE EXCEPTION 'FORCE must apply to owner'; END IF;
END $$;
RESET ROLE;
REVOKE SELECT ON cap_role_test.records FROM cap_bypass;
DO $$ BEGIN
 IF has_table_privilege('cap_bypass','cap_role_test.records','SELECT') THEN
 RAISE EXCEPTION 'BYPASSRLS must not imply SELECT'; END IF;
END $$;

-- Alternate view path survives name-scoped hardening, even with base RLS FORCE.
CREATE VIEW public.unrelated_cap_leak AS SELECT * FROM public.hwb_db_stampings;
GRANT SELECT ON public.unrelated_cap_leak TO anon;
SET ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.unrelated_cap_leak)<>1 THEN RAISE EXCEPTION 'View leak fixture missing'; END IF;
END $$;
RESET ROLE;

-- Inherited and column-only access must not disappear from the inventory.
GRANT SELECT ON public.hwb_db_stampings TO cap_parent;
GRANT cap_child TO anon;
GRANT SELECT(id) ON public.hwb_db_stampings TO authenticated;
DO $$ BEGIN
 IF NOT has_table_privilege('anon','public.hwb_db_stampings','SELECT') THEN
 RAISE EXCEPTION 'Inherited grant fixture missing'; END IF;
 IF has_table_privilege('authenticated','public.hwb_db_stampings','SELECT') OR
 NOT has_any_column_privilege('authenticated','public.hwb_db_stampings','SELECT') THEN
 RAISE EXCEPTION 'Column grant fixture missing'; END IF;
END $$;

-- Schema creator defaults apply only to future objects created by that role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO anon;
CREATE TABLE public.hwb_db_future(id integer);
DO $$ BEGIN
 IF NOT has_table_privilege('anon','public.hwb_db_future','SELECT') OR
 (SELECT relrowsecurity FROM pg_class WHERE oid='public.hwb_db_future'::regclass) THEN
 RAISE EXCEPTION 'Deployment drift fixture missing'; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);
INSERT INTO auth.sessions VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',NULL);
GRANT USAGE ON SCHEMA auth TO cap_plain;
GRANT SELECT(id,user_id,not_after) ON auth.sessions TO cap_plain;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
SET ROLE cap_plain;
DO $$ BEGIN
 IF NOT has_column_privilege(current_user,'auth.sessions','not_after','SELECT') OR
 (SELECT count(*) FROM auth.sessions)<>0 THEN
 RAISE EXCEPTION 'Session grants alone must not prove visible sessions'; END IF;
END $$;
RESET ROLE;
