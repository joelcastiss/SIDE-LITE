-- One atomic shared budget for guesses across accounts and codes.
create table side_lite_private.lite_admission_global_window (
  singleton boolean primary key default true check (singleton),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 1001)
);
alter table side_lite_private.lite_admission_global_window enable row level security;
revoke all on side_lite_private.lite_admission_global_window from public, anon, authenticated, service_role;
grant select, insert, update on side_lite_private.lite_admission_global_window to side_lite_api;
