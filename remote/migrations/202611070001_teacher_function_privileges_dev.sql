-- SIDE-LITE development only. Run after 202611040004; do not apply to SIDE1.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Restrict
-- SECURITY DEFINER entry points to the API role; the function owner retains
-- implicit rights, including to the internal email predicate.
REVOKE ALL ON FUNCTION lite.teacher_email_permitted(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lite.teacher_authorized(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION lite.activate_teacher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lite.teacher_authorized(uuid) TO lite_dev_api;
GRANT EXECUTE ON FUNCTION lite.activate_teacher(uuid) TO lite_dev_api;
