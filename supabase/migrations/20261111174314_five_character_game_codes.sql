alter table public.lite_games drop constraint lite_games_code_check;
alter table public.lite_games add constraint lite_games_code_check check (code ~ '^([A-Z0-9]{5}|[A-F0-9]{8})$');

-- Reproduce column grants present in the hosted schema but absent from its
-- recorded history. RLS and the lock_guard invariant remain in force.
grant insert (id, display_name), update (display_name) on public.lite_profiles to authenticated;
grant update (lock_guard) on side_lite_private.lite_teacher_grants to service_role;
