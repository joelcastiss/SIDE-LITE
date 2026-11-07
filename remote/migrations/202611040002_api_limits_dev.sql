-- Development branch only. No raw user identity is stored.
CREATE TABLE IF NOT EXISTS lite.lite_api_limits (
  key_hash text PRIMARY KEY CHECK(length(key_hash)=64),
  attempts integer NOT NULL CHECK(attempts>0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS lite_api_limits_expiry_idx ON lite.lite_api_limits(expires_at);
GRANT SELECT, INSERT, UPDATE ON lite.lite_api_limits TO lite_dev_api;
