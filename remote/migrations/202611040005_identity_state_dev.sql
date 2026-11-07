-- SIDE-LITE only. Query current Neon Auth state on every request; JWTs are short-lived but account status may change.
CREATE OR REPLACE FUNCTION lite.identity_allowed(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM neon_auth."user" u
   WHERE u.id=p_user AND u."emailVerified" IS TRUE AND NOT coalesce(u.banned,false));
$$;
REVOKE ALL ON FUNCTION lite.identity_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lite.identity_allowed(uuid) TO lite_dev_api;
