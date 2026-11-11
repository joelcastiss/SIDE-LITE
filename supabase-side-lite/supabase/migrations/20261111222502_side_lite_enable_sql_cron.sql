-- Apply the SQL closer migration and verify manual closing before installation.
-- Run only on the intended Supabase project after completing local validation.
do $$
begin
  if exists(select 1 from cron.job where jobname='side-lite-sql-close-v2') then
    raise exception 'El programador SQL ya existe';
  end if;
  perform cron.schedule('side-lite-sql-close-v2','10 seconds',
    'call side_lite_private.side_cron_sweep()');
end $$;
