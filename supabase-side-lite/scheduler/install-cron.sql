-- Preparación de Cron para SIDE-LITE. No ejecutar hasta validar destino, Vault,
-- permisos del esquema net, coste y copia de seguridad. No contiene secretos.
-- Requiere Vault names side_lite_closer_secret y side_lite_gateway_key.
-- Se separa de las migraciones de esquema: la activación requiere autorización.
DO $$
BEGIN
 IF current_setting('app.side_lite_cron_approved',true) IS DISTINCT FROM 'hwwwoblfpsqqrkxvclag' THEN
   RAISE EXCEPTION 'Falta la aprobación y verificación explícita del destino';
 END IF;
 IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name IN ('side_lite_closer_secret','side_lite_gateway_key')) <> 2 THEN
   RAISE EXCEPTION 'Faltan secretos independientes en Vault';
 END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='side-lite-close-cycle') THEN
   RAISE EXCEPTION 'Ya existe un trabajo con este nombre';
 END IF;
 PERFORM cron.schedule('side-lite-close-cycle','10 seconds',$job$
   SELECT net.http_post(
     url := 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle',
     headers := jsonb_build_object('Content-Type','application/json',
       'apikey',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='side_lite_gateway_key'),
       'x-side-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='side_lite_closer_secret')),
     body := '{}'::jsonb, timeout_milliseconds := 15000
   );
 $job$);
END $$;
