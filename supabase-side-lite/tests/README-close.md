# Prueba local de cierre en PostgreSQL

Usar exclusivamente una instancia local desechable vacía. Esta prueba inserta datos y roles; no usar una base con datos que se quieran conservar. Es una prueba PostgreSQL, no una prueba de Supabase Auth ni del entorno Edge. Instalar temporalmente `postgres@3.4.7` en una carpeta fuera del repositorio y disponer del cliente `psql`.

1. Crear una base PostgreSQL local vacía. Aplicar en ella `postgres-auth-bootstrap.sql` y después `../supabase/migrations/20261109020500_side_lite_core.sql` con `psql -v ON_ERROR_STOP=1`. El bootstrap imita mínimamente Auth y es **solo para pruebas**, jamás para Supabase remoto.
2. En PowerShell, configurar `SIDE_TEST_DISPOSABLE=YES`, `SIDE_TEST_DATABASE_URL` como URL de esa base local y `SIDE_TEST_POSTGRES_MODULE` como ruta absoluta al archivo `node_modules/postgres/src/index.js` del paquete temporal.
3. Ejecutar `node supabase-side-lite/tests/postgres-close-smoke.mjs` desde la raíz del repositorio. Ejecutar una sola vez en una base vacía: utiliza UUID y códigos fijos para que las aserciones sean reproducibles.

La prueba verifica los 120 segundos entre inicio y deadline, que no se cierre un ciclo aún vigente, que dos workers concurrentes no dupliquen resultados, y que un fallo económico revierta la transacción. Para no esperar 120 segundos, el cierre de concurrencia usa una solicitud anticipada; **no acredita Cron, ejecución sin navegadores, cumplimiento de tiempo real ni despliegue Edge**. El usuario de prueba tiene privilegios totales y no valida RLS o el rol mínimo del worker. No poner contraseñas reales en estos archivos ni usar proyectos remotos.
