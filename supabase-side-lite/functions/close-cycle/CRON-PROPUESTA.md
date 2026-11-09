# Programador propuesto, inactivo

No ejecutar sin autorización expresa y sin resolver primero el acceso de los roles LOGIN a `pg_net`. No se ha creado un job, secreto ni extensión con este archivo.

Se propone `side-lite-close-due` cada **30 segundos**, evaluando en PostgreSQL si existe un ciclo abierto no pausado y vencido o cuyo cierre se solicitó. Solo si existe, se encolaría una invocación de `close-cycle`. La fecha límite sigue siendo 120 segundos; el resultado puede llegar posteriormente, normalmente en el siguiente barrido y con más retraso ante congestión o fallos. El trabajador es idempotente y limita cada barrido a 20 intentos. Confirmar la semántica y latencia en el proyecto antes de utilizarlo con estudiantes.

Ejemplo concreto sujeto a revisión de permisos y previa creación controlada del secreto `side_lite_closer_secret` en Vault y del mismo valor en `SIDE_CLOSER_SECRET` de la función. No incorporar valores de secreto al repositorio ni al historial de SQL:

```sql
select cron.schedule('side-lite-close-due', '30 seconds', $job$
  select net.http_post(
    url := 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-side-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'side_lite_closer_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (
    select 1 from public.lite_cycles
    where status = 'open' and paused_at is null
      and (ends_at <= clock_timestamp() or close_requested_at is not null)
  );
$job$);
```

El trabajo condicional evita hasta 2.880 llamadas HTTP diarias cuando no hay ciclos pendientes, pero PostgreSQL seguirá ejecutando el sondeo 2.880 veces al día. En el peor caso son 86.400 llamadas en 30 días, además de las de la API; el límite Free publicado es 500.000 invocaciones mensuales, sujeto a condiciones y cambios. La base pausada o los límites de ejecución pueden impedir el cierre puntual.

**Riesgo pendiente:** Supabase advierte que los roles con LOGIN pueden leer la cola de `pg_net`, incluidos encabezados descifrados aunque el valor provenga de Vault. La API propuesta usa una credencial PostgreSQL LOGIN: por tanto una intrusión en ese proceso podría acceder al secreto del cierre. No afirmar que la separación es segura ni activar este diseño hasta adoptar y verificar una mitigación apropiada. El secreto no es una clave privilegiada de Supabase, pero permitiría invocar el cierre; este solo procesa ciclos elegibles. Véanse [credenciales en pg_net](https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357), [cron](https://supabase.com/docs/guides/functions/schedule-functions) y [cuotas](https://supabase.com/docs/guides/functions/pricing).

**Observabilidad:** el éxito del job solo indica que PostgreSQL encoló la solicitud; no demuestra respuesta HTTP satisfactoria ni cierre económico. Deben conservarse y asociarse los ID de solicitud con `net._http_response`, alertar por fallos, retrasos y ciclos vencidos, y revisar logs de la función. Las respuestas de `pg_net` tienen retención limitada. Esta correlación persistente y alertas aún no están implementadas.

**Reversión tras activación:** detener el job mediante `select cron.unschedule('side-lite-close-due');`, verificar que dejó de existir y deshabilitar o retirar la función y rotar el secreto cuando corresponda. No borrar tablas, resultados, secretos ajenos ni extensiones compartidas. Si quedan ciclos vencidos, el proceso se recuperará al restablecer de forma segura el barrido; no se debe recalcular desde el navegador.
