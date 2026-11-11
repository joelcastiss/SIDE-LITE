-- Apply only to an isolated environment after the deployment plan is reviewed.
-- Grant the API role INSERT/SELECT on nonces, and a distinct proxy role only
-- SELECT/INSERT/UPDATE on the IP window table. Schedule deletion of expired rows.
create table side_lite_private.ingress_nonces (nonce text primary key, expires_at timestamptz not null);
create index ingress_nonces_expiry on side_lite_private.ingress_nonces(expires_at);
create table side_lite_private.ingress_ip_windows (ip_hash bytea primary key, window_started_at timestamptz not null, attempts integer not null check (attempts between 1 and 61));
alter table side_lite_private.ingress_nonces enable row level security;
alter table side_lite_private.ingress_ip_windows enable row level security;
revoke all on side_lite_private.ingress_nonces, side_lite_private.ingress_ip_windows from public, anon, authenticated, service_role;
