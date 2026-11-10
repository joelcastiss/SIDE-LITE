-- Defense in depth: shared per-code admission budgets across anonymous identities.
-- Trusted-edge IP throttling and Auth CAPTCHA are still required independently.
create table side_lite_private.lite_admission_code_windows (
 code_hash bytea primary key check(octet_length(code_hash)=32),
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 121)
);
alter table side_lite_private.lite_admission_code_windows enable row level security;
revoke all on side_lite_private.lite_admission_code_windows from public,anon,authenticated,service_role;
grant select,insert,update on side_lite_private.lite_admission_code_windows to side_lite_api;
