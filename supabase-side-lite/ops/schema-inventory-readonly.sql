-- Read-only catalog inventory. Run against the disposable reference first, then
-- against the confirmed SIDE-LITE project. Compare results; a matching object
-- name alone is NOT evidence that its definition matches the migration.
-- Does not read application rows, credentials, configuration secrets or files.
with objects as (
  select c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         c.relacl
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p','v','m','S') and
    ((n.nspname='public' and c.relname like 'lite\_%' escape '\') or n.nspname='side_lite_private')
), inventory as (
  select 'relation'::text as kind, format('%I.%I',nspname,relname) as name,
    jsonb_build_object('kind',relkind,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'acl',relacl::text) as details from objects
  union all
  select 'column',format('%I.%I.%I',o.nspname,o.relname,a.attname),
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl::text)
  from objects o join pg_attribute a on a.attrelid=o.oid and a.attnum>0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  union all
  select 'constraint',format('%I.%I.%I',o.nspname,o.relname,c.conname),
    jsonb_build_object('definition',pg_get_constraintdef(c.oid,true),'validated',c.convalidated)
  from objects o join pg_constraint c on c.conrelid=o.oid
  union all
  select 'index',format('%I.%I',o.nspname,i.relname),jsonb_build_object('definition',pg_get_indexdef(i.oid))
  from objects o join pg_index x on x.indrelid=o.oid join pg_class i on i.oid=x.indexrelid
  union all
  select 'policy',format('%I.%I.%I',o.nspname,o.relname,p.polname),
    jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles::text,
      'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))
  from objects o join pg_policy p on p.polrelid=o.oid
  union all
  select 'function',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),
    jsonb_build_object('definition_md5',md5(pg_get_functiondef(p.oid)),
      'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname like 'lite\_%' escape '\') or n.nspname='side_lite_private'
  union all
  select 'trigger',format('%I.%I.%I',n.nspname,c.relname,t.tgname),
    jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and t.tgname like 'lite\_%' escape '\'
  union all
  select 'role',r.rolname,jsonb_build_object('login',r.rolcanlogin,'bypass_rls',r.rolbypassrls,
    'superuser',r.rolsuper,'inherit',r.rolinherit)
  from pg_roles r where r.rolname in ('side_lite_api','side_lite_closer')
  union all
  select 'membership',format('%I -> %I',parent.rolname,member.rolname),
    jsonb_build_object('admin',m.admin_option)
  from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles member on member.oid=m.member
  where parent.rolname in ('side_lite_api','side_lite_closer') or member.rolname in ('side_lite_api','side_lite_closer')
)
select kind,name,details from inventory order by kind,name;
