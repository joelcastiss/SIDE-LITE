# Cierre de ciclos

La implementación SQL de la migración `side_lite_sql_closer` ejecuta el cierre
oficial tanto desde el control manual como desde `pg_cron`. Usa el mismo bloqueo
de ciclo que las decisiones, escribe los resultados y actualiza la caja en una
transacción por partida. `side_cron_sweep` confirma cada partida por separado y
registra fallos individuales. El trabajo se instala por separado mediante
`scheduler/install-sql-cron.sql`; el vencimiento es de 120 segundos y el
resultado puede tardar hasta el siguiente barrido o más si ocurre un fallo.

La función Edge `close-cycle` queda retirada: la fuente responde 410 sin hacer
ningún cierre. La versión que estaba publicada durante la investigación usaba
un secreto persistente; hasta desplegar la retirada esa versión anterior sigue
operativa. Cron SQL no la invoca y no necesita HTTP, tickets ni secretos. No use el antiguo borrador
`scheduler/install-cron.sql`, que pasa tickets por la cola de `pg_net`.

El motor SQL conserva valores precalculados de `marketingFactor` del motor
JavaScript; cualquier cambio en reglas exige revisar ambos y repetir las
pruebas de paridad. Véase `../../experimental/README.md` para su alcance y
limitaciones. Antes de activar el trabajo se deben validar migración, permisos,
control manual y `CALL` desde cron en una base aislada y luego comprobar la
instalación y resultados reales en el proyecto previsto.
