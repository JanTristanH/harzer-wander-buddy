-- Catalogue only. Run inside BEGIN READ ONLY (see inspectCapDatabase.js).
-- No application rows, view bodies, function bodies, tokens or settings secrets.
SELECT 'identity' AS section, current_user AS runtime_role, session_user AS login_role,
 current_database() AS database_name, current_schema() AS schema_name,
 current_setting('search_path') AS search_path,
 current_setting('transaction_read_only') AS read_only,
 current_setting('server_version') AS server_version;

SELECT 'roles' AS section, r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit,
 pg_has_role(current_user, r.oid, 'USAGE') AS effective_membership,
 pg_has_role(current_user, r.oid, 'MEMBER') AS membership,
 pg_has_role(current_user, r.oid, 'SET') AS can_set_role
FROM pg_roles r WHERE r.rolname IN (current_user, session_user, 'anon', 'authenticated', 'service_role')
 OR pg_has_role(current_user, r.oid, 'MEMBER') ORDER BY r.rolname;

SELECT 'schemas' AS section, n.nspname, pg_get_userbyid(n.nspowner) AS owner,
 pg_has_role(current_user, n.nspowner, 'USAGE') AS runtime_owner_rights,
 has_schema_privilege(current_user, n.oid, 'USAGE') AS runtime_usage,
 has_schema_privilege(current_user, n.oid, 'CREATE') AS runtime_create,
 n.nspacl::text AS acl
FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema';

-- All user relations, not a fixed list of 15. Includes views, foreign tables,
-- partitions and materialized views outside public to reveal alternate paths.
SELECT 'relations' AS section, n.nspname, c.relname, c.relkind,
 pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity,
 pg_has_role(current_user, c.relowner, 'USAGE') AS runtime_owner_rights,
 CASE WHEN c.relkind IN ('r','p') THEN row_security_active(c.oid) END AS runtime_rls_active,
 r.rolname AS checked_role, has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
 has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
 has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
 has_table_privilege(r.oid,c.oid,'REFERENCES') AS can_references,
 has_table_privilege(r.oid,c.oid,'TRIGGER') AS can_trigger,
 has_table_privilege(r.oid,c.oid,'MAINTAIN') AS can_maintain,
 has_any_column_privilege(r.oid,c.oid,'SELECT') AS any_column_select,
 has_any_column_privilege(r.oid,c.oid,'INSERT') AS any_column_insert,
 has_any_column_privilege(r.oid,c.oid,'UPDATE') AS any_column_update,
 c.reloptions, c.relacl::text AS acl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_'
 AND n.nspname <> 'information_schema'
 AND r.rolname IN (current_user,'anon','authenticated','service_role')
ORDER BY n.nspname,c.relname,r.rolname;

-- auth.sessions: exact columns used by srv/supabase-auth.js. Missing relation or
-- columns remain visible as NULL/false. This does NOT prove a real session is visible.
SELECT 'session_columns' AS section, to_regclass('auth.sessions')::text AS relation,
 x.column_name, a.attname IS NOT NULL AS column_exists,
 CASE WHEN a.attname IS NOT NULL THEN
 has_column_privilege(current_user,a.attrelid,a.attnum,'SELECT') END AS runtime_select
FROM (VALUES ('id'),('user_id'),('not_after')) x(column_name)
LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('auth.sessions')
 AND a.attname=x.column_name AND a.attnum>0 AND NOT a.attisdropped;

-- Policy metadata only: expressions may contain private literals. Inspect those
-- separately under operator control, never execute them as part of this inventory.
SELECT 'policies' AS section, n.nspname,c.relname,p.polname,p.polcmd,
 p.polpermissive, ARRAY(SELECT CASE WHEN role_id=0 THEN 'PUBLIC'
 ELSE pg_get_userbyid(role_id)::text END FROM unnest(p.polroles) role_id) AS roles
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
JOIN pg_namespace n ON n.oid=c.relnamespace;

-- Immediate view edges across schemas. Follow repeated edges transitively.
-- Materialized views expose stored rows independently of base-table RLS.
SELECT DISTINCT 'view_edges' AS section, vn.nspname AS view_schema,v.relname AS view_name,
 v.relkind,v.reloptions,pg_get_userbyid(v.relowner) AS view_owner,
 bn.nspname AS source_schema,b.relname AS source_name
FROM pg_rewrite rw JOIN pg_class v ON v.oid=rw.ev_class
JOIN pg_namespace vn ON vn.oid=v.relnamespace
JOIN pg_depend d ON d.classid='pg_rewrite'::regclass AND d.objid=rw.oid
 AND d.refclassid='pg_class'::regclass
JOIN pg_class b ON b.oid=d.refobjid JOIN pg_namespace bn ON bn.oid=b.relnamespace
WHERE v.relkind IN ('v','m') AND b.oid<>v.oid AND vn.nspname !~ '^pg_'
 AND vn.nspname<>'information_schema';

-- RPC candidates: EXECUTE includes PUBLIC and inherited grants. No RPC is called.
-- Dynamic SQL dependencies cannot be proven from pg_depend. Review code separately.
SELECT 'routines' AS section,n.nspname,p.proname,p.oid AS routine_oid,p.prokind,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,r.rolname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute,p.proacl::text AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 AND r.rolname IN ('anon','authenticated','service_role');

-- Creator-specific, global AND schema-local defaults. Absence is not proof of
-- safe defaults (functions default to PUBLIC EXECUTE); also inspect DDL hooks.
SELECT 'default_acl' AS section,pg_get_userbyid(d.defaclrole) AS creator,
 n.nspname,d.defaclobjtype,d.defaclacl::text AS acl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace;

SELECT 'ddl_hooks' AS section,evtname,evtevent,evtenabled,
 evtfoid::regproc::text AS handler FROM pg_event_trigger;

SELECT 'sequences' AS section,n.nspname,c.relname,r.rolname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_sequence_privilege(r.oid,c.oid,'USAGE') AS can_use,
 has_sequence_privilege(r.oid,c.oid,'SELECT') AS can_select,
 has_sequence_privilege(r.oid,c.oid,'UPDATE') AS can_update,c.relacl::text AS acl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE c.relkind='S' AND n.nspname !~ '^pg_'
 AND r.rolname IN (current_user,'anon','authenticated','service_role');
