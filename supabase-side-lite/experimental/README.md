# Cierre SQL experimental

El prototipo traslada el motor v2 a PostgreSQL para que `pg_cron` pueda cerrar
sin un programador externo, HTTP ni credenciales transmitidas. La tabla de
factores contiene los 9.802 valores posibles calculados por `marketingFactor`
de `js/engine.js`; se usa porque `ln(1+x)` de PostgreSQL no reproduce siempre
los mismos bits que `Math.log1p` de JavaScript. Al modificar el motor hay que
revisar y regenerar estos valores y las pruebas de equivalencia.

`engine-v2-parity.mjs` compara 12.000 casos contra el motor JavaScript.
`close-one-parity.mjs` verifica partidas de 3 y 6 ciclos, dos empresas y dos
cerradores concurrentes en una base local desechable. Con
`SIDE_TEST_SQL_MIGRATION=YES` prueba la migración y el rol restringido. Ambas
pruebas requieren `SIDE_TEST_DISPOSABLE=YES` y una URL de PostgreSQL local
en `SIDE_LITE_TEST_DATABASE_URL`. No ejecutar contra bases con datos reales.

La migración se genera con el CLI de Supabase y `generate-migration.mjs`;
`scheduler/install-sql-cron.sql` queda separado para validar primero la
migración y el cierre manual. El procedimiento de cron confirma cada partida
por separado y registra un aviso sin datos de decisiones ante un error.
Estas pruebas no sustituyen la verificación de Edge, RLS, cron y resultados
en el proyecto alojado ni prueban todas las combinaciones posibles.
