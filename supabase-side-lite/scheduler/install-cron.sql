-- Apply the ticket migration and deploy the matching Edge function before
-- enabling this job. The target must be verified explicitly.
DO $$
BEGIN
 IF current_setting('app.side_lite_cron_approved',true) IS DISTINCT FROM 'hwwwoblfpsqqrkxvclag' THEN
   RAISE EXCEPTION 'Falta la aprobación y verificación explícita del destino';
 END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='side-lite-close-cycle') THEN
   RAISE EXCEPTION 'Ya existe un trabajo con este nombre';
 END IF;
 PERFORM cron.schedule('side-lite-close-cycle','10 seconds',$job$
   DO $run$
   DECLARE ticket text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
   BEGIN
     DELETE FROM side_lite_private.lite_closer_tickets WHERE expires_at < clock_timestamp();
     INSERT INTO side_lite_private.lite_closer_tickets(token_hash,expires_at)
       VALUES (sha256(convert_to(ticket,'UTF8')), clock_timestamp() + interval '60 seconds');
     PERFORM net.http_post(
       url := 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle',
       headers := jsonb_build_object('Content-Type','application/json',
         'apikey','sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN',
         'x-side-cron-ticket',ticket),
       body := '{}'::jsonb, timeout_milliseconds := 15000
     );
   END $run$;
 $job$);
END $$;
