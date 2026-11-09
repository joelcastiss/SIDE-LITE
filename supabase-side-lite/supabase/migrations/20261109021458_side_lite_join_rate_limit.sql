-- Prepared locally only; do not apply to a remote project without review.
-- One bounded counter per verified user. No caller-supplied IP or code is stored.
create table side_lite_private.lite_join_attempt_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 11)
);
alter table side_lite_private.lite_join_attempt_windows enable row level security;
revoke all on side_lite_private.lite_join_attempt_windows from public, anon, authenticated;
-- A privileged API role can use this table, but must never be available to the
-- browser. Prefer a dedicated restricted DB role during deployment review.
grant select, insert, update on side_lite_private.lite_join_attempt_windows to service_role;
