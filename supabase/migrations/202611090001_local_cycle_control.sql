ALTER TABLE lite_cycles ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE lite_cycles ADD COLUMN IF NOT EXISTS close_requested_at timestamptz;
