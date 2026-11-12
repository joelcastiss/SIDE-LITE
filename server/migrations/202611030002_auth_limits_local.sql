-- Local development database only. Opaque hashed keys avoid storing raw account or network identifiers.
CREATE TABLE IF NOT EXISTS lite_auth_limits (
  key_hash text PRIMARY KEY CHECK (length(key_hash)=64),
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS lite_auth_limits_expiry_idx ON lite_auth_limits(expires_at);
