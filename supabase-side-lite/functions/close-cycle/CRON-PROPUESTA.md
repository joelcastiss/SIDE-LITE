# Programador preparado, sin activar

La implementación candidata está en `../../scheduler/worker.js`, con una configuración de ejemplo que no activa ningún trigger. Un programador externo puede invocar directamente la función Edge con un secreto almacenado solo en el proveedor externo y en la función, sin pasar por `pg_net`. La función no expone una ruta HTTP propia en el programador. La prueba local usa respuestas simuladas: **no certifica el proveedor, el secreto, la conectividad ni el cierre desplegado**.

La configuración de ejemplo usa el formato de Cloudflare Workers, pero no presupone cuenta, plan ni autorización de despliegue. Su cron admite intervalos de un minuto; aun con puntualidad perfecta, los resultados pueden aparecer hasta un minuto después de los 120 segundos, y fallas o retrasos pueden prolongar ese plazo. Antes de utilizarlo se debe aceptar un objetivo de latencia y verificarlo bajo carga, junto con costes, límites, alertas y recuperación. No afirmar que el cálculo termina exactamente a los 120 segundos.

## Activación futura y reversión

1. Verificar en un proyecto y un proveedor aislados que las funciones Edge, sus roles y la configuración de red sean correctos; aprovisionar el mismo secreto aleatorio independiente en el proveedor de programación y en `SIDE_CLOSER_SECRET` de Edge por sus mecanismos de secretos. Nunca guardar el valor en Git ni en una instrucción SQL.
2. Habilitar un trigger de un minuto solo tras revisar el proveedor y la latencia. Comprobar que los eventos fallidos se detectan y alertan, que los ciclos vencidos se recuperan tras interrupciones y que las llamadas concurrentes no duplican resultados. El trigger no demuestra que el cierre haya tenido éxito; vigilar los resultados, las respuestas HTTP y los ciclos vencidos.
3. Para revertir, desactivar o eliminar el trigger, comprobar que no haya nuevas invocaciones y rotar o eliminar el secreto en ambos extremos. No borrar tablas ni resultados. Los ciclos vencidos se procesarán cuando se restablezca el barrido autorizado.

## Por qué no se activa pg_cron + pg_net

La [documentación de Supabase](https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357) indica que las credenciales de una petición quedan visibles en la cola incluso cuando proceden de Vault. Además, los roles con LOGIN pueden leer y modificar esa cola y [Supabase no admite revocar esos permisos por proyecto](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16). La API propuesta usa una conexión PostgreSQL propia: poner el secreto del cierre en esa cola permitiría a un compromiso de la API obtenerlo.

Una firma HMAC podría ocultar el secreto, pero una solicitud firmada en la cola puede ser observada y reproducida o interferida por un rol con acceso. No se ha diseñado ni probado aquí protección contra repetición ni integridad de la cola. No activar este mecanismo bajo la suposición de que Vault, por sí solo, protege los encabezados en tránsito.

Fuentes: [cron de Workers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [programación de funciones Edge](https://supabase.com/docs/guides/functions/schedule-functions).
