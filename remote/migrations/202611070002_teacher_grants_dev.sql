-- SIDE-LITE isolated test/development branch only. Do not apply to SIDE1.
-- Verified institutional e-mail alone does not confer teaching privileges.
-- Administrators provision or revoke exact normalized e-mail addresses out of band.
CREATE TABLE IF NOT EXISTS lite.teacher_grants (
 email text PRIMARY KEY CHECK (email=lower(btrim(email)) AND lite.teacher_email_permitted(email)),
 active boolean NOT NULL DEFAULT true,
 granted_at timestamptz NOT NULL DEFAULT now(),
 note text NOT NULL CHECK (length(btrim(note)) > 0)
);
REVOKE ALL ON TABLE lite.teacher_grants FROM PUBLIC, lite_dev_api;

CREATE OR REPLACE FUNCTION lite.teacher_authorized(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM neon_auth."user" u
 JOIN lite.lite_profiles p ON p.id=u.id
 JOIN lite.teacher_grants g ON g.email=lower(btrim(u.email)) AND g.active
 WHERE u.id=p_user AND p.role='teacher' AND u."emailVerified" IS TRUE
 AND NOT coalesce(u.banned,false) AND lite.teacher_email_permitted(u.email));
$$;
CREATE OR REPLACE FUNCTION lite.activate_teacher(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM neon_auth."user" u
 JOIN lite.teacher_grants g ON g.email=lower(btrim(u.email)) AND g.active
 WHERE u.id=p_user AND u."emailVerified" IS TRUE AND NOT coalesce(u.banned,false)
 AND lite.teacher_email_permitted(u.email)) THEN RETURN false; END IF;
 UPDATE lite.lite_profiles SET role='teacher' WHERE id=p_user;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION lite.teacher_authorized(uuid), lite.activate_teacher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lite.teacher_authorized(uuid), lite.activate_teacher(uuid) TO lite_dev_api;
