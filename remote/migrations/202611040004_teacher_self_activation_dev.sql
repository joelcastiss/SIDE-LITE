-- SIDE-LITE development only. Institutional status never changes a student profile until the owner chooses the teacher area.
CREATE OR REPLACE FUNCTION lite.teacher_email_permitted(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT lower(btrim(coalesce(p_email,''))) ~ '^[^[:space:]@]+@upch[.]pe$';
$$;
CREATE OR REPLACE FUNCTION lite.teacher_authorized(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM neon_auth."user" u JOIN lite.lite_profiles p ON p.id=u.id
 WHERE u.id=p_user AND p.role='teacher' AND u."emailVerified" IS TRUE
 AND NOT coalesce(u.banned,false) AND lite.teacher_email_permitted(u.email));
$$;
CREATE OR REPLACE FUNCTION lite.activate_teacher(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM neon_auth."user" u WHERE u.id=p_user
   AND u."emailVerified" IS TRUE AND NOT coalesce(u.banned,false)
   AND lite.teacher_email_permitted(u.email)) THEN RETURN false; END IF;
 UPDATE lite.lite_profiles SET role='teacher' WHERE id=p_user;
 RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION lite.activate_teacher(uuid) TO lite_dev_api;
GRANT EXECUTE ON FUNCTION lite.teacher_authorized(uuid) TO lite_dev_api;
