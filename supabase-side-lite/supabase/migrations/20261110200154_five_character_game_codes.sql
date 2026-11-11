-- Preserve existing hexadecimal codes while allowing newly generated codes.
-- The existing unique constraint remains in force for both formats.
alter table public.lite_games drop constraint lite_games_code_check;
alter table public.lite_games add constraint lite_games_code_check
  check (code ~ '^([A-Z0-9]{5}|[A-F0-9]{8})$');
