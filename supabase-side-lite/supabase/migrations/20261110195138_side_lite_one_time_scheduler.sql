-- One-use credentials for the Supabase-only cycle scheduler. No bearer secret
-- is stored here: only the SHA-256 hash of a 244-bit random token.
create table side_lite_private.lite_closer_tickets (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  expires_at timestamptz not null
);
alter table side_lite_private.lite_closer_tickets enable row level security;
revoke all on side_lite_private.lite_closer_tickets from public, anon, authenticated, service_role;
grant select, delete on side_lite_private.lite_closer_tickets to side_lite_closer;
