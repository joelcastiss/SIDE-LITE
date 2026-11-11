# Seguridad del programador de cierre

El reemplazo preparado usa `install-sql-cron.sql` y ejecuta PostgreSQL
directamente, sin HTTP ni credenciales en la cola. Las observaciones siguientes
documentan por qué no debe instalarse el antiguo `install-cron.sql`; no prueban
el despliegue ni la operación del reemplazo.

El programador preparado en `install-cron.sql` no debe activarse en el proyecto
alojado mientras se exija que la credencial del cierre no sea accesible a roles
de base de datos no autorizados. El ticket se usa una sola vez y vence a los 60
segundos, pero `pg_net` lo coloca en `net.http_request_queue` antes de enviarlo.
Supabase documenta que los roles que pueden conectarse a la base pueden leer esa
cola y que no se admite restringir sus permisos o habilitar RLS por proyecto.
Vault protege secretos en reposo, pero no elimina la exposición en la cola.

En la revisión del proyecto SIDE-LITE se comprobó que `side_lite_api`,
`side_lite_api_edge`, `side_lite_closer` y `supabase_read_only_user` pueden
conectarse y leerla. El esquema `net` no está expuesto mediante la Data API por
defecto, lo que reduce el alcance, pero no elimina el acceso de esos roles. No
se debe colocar en la cola una clave persistente ni presentar el ticket como
inaccesible para esos roles. Fuente: https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357

El cierre comprueba el vencimiento con el reloj de PostgreSQL y bloquea las
filas de ciclos para evitar resultados duplicados. Eso reduce el efecto de una
invocación repetida, pero no satisface por sí solo el requisito de aislamiento
de credenciales. Antes de activar Cron se necesita una alternativa compatible
con Supabase que elimine esa exposición o un cambio confirmado de la plataforma;
después deben probarse entrega, concurrencia, cierre automático y recuperación
con una partida alojada.

## Evaluación de señal pública sin credenciales

PostgreSQL puede autorizar atómicamente un trabajo vencido sin confiar en el
cuerpo HTTP. `scripts/test-expiring-wakeup-experiment.mjs` comprobó en un
PostgreSQL aislado el rechazo antes del vencimiento, una única concesión entre
50 peticiones simultáneas, el rechazo de repetición y la recuperación tras
rollback. Es un experimento, no está integrado con el cerrador ni constituye
una autorización de acceso a producción.

El experimento también muestra su límite: las 50 peticiones alcanzaron la base.
Una señal HTTP pública llegaría primero a Edge Functions y consumiría
invocaciones aun cuando la base rechazara casi todas. La documentación de
Supabase indica que sus límites de llamadas recursivas no limitan solicitudes
entrantes. Por tanto, un control dentro de PostgreSQL no demuestra protección
perimetral frente a abuso ni consumo ilimitado; no se ha desplegado esa vía.
Fuente: https://supabase.com/docs/guides/functions/recursive-functions

`pg_cron` puede ejecutar funciones SQL privadas directamente, pero el motor
económico es JavaScript. El proyecto usa PostgreSQL 17 y Supabase indica que
su distribución 17 no incluye `plv8`; no se ha duplicado ni trasladado el
motor. Fuente: https://supabase.com/changelog/35851-forthcoming-postgres-17-release-notes

## Alternativa a evaluar: HTTP síncrono

La extensión `http` aparece disponible en el catálogo del proyecto, aunque no
está instalada. Una llamada síncrona desde `pg_cron` evita la cola de `pg_net`.
Una posibilidad sería generar en memoria una credencial efímera, guardar solo
su hash, confirmar esa transacción antes de la llamada y transmitirla por TLS
al cerrador ya autenticado. Si falla la entrega, una ejecución posterior debe
recuperar el ciclo vencido. No se ha desplegado ni se ha demostrado esta vía.

Hay condiciones técnicas pendientes: PostgreSQL no permite `COMMIT` dentro de
un procedimiento `SECURITY DEFINER` ni de uno con cláusula `SET`, de modo que
hay que verificar el rol y la ejecución real de `CALL` desde `pg_cron`. Además,
el código de `pgsql-http` 1.6.3 registra las cabeceras a nivel `DEBUG2`: los
controles de registro, TLS, tiempos de espera y errores deben probarse con la
versión alojada sin exponer valores. Un token en memoria puede persistir como
hash temporal tras un fallo, pero el token legible no debe terminar en consultas,
registros, respuestas ni colas. `supabase_read_only_user` puede leer Vault, por
lo que trasladar ahí una clave persistente no elimina por sí solo la exposición
a roles de lectura. Las pruebas de red, repetición, caídas y concurrencia deben
completarse antes de adoptar la alternativa.

La prueba local `scripts/test-synchronous-wakeup-experiment.mjs` quedó bloqueada
antes de ejecutarse: Windows Application Control impidió cargar la biblioteca
`http.dll` descargada para PostgreSQL temporal. No se desactivó esa protección;
esta prueba no demuestra el comportamiento de Supabase alojado.

La ejecución aislada de GitHub Actions del 10 de noviembre de 2026 compiló
`pgsql-http` v1.6.3 (extensión SQL 1.6) con PostgreSQL 17 y `pg_cron`. La llamada
síncrona desde `CALL` funcionó con TLS, rechazó el certificado no confiable y
rechazó diez repeticiones del token. Sin embargo, al habilitar `DEBUG2`, el token
ficticio transmitido en una cabecera apareció en el registro de PostgreSQL. Por
eso esta variante **no cumple** el requisito de que las credenciales no se
expongan en registros y no se ha desplegado. La prueba no demuestra un cierre
real de 120 segundos ni recuperación tras interrupción.

Evidencia: https://github.com/joelcastiss/SIDE-LITE/actions/runs/42945917428

Como verificación parcial independiente de esa biblioteca,
`scripts/test-procedure-commit-experiment.mjs` comprobó en PostgreSQL 17 local
que una segunda sesión ve el hash tras `COMMIT` mientras continúa `CALL`, y que
la variable del procedimiento conserva su valor después del commit. No prueba
que `pg_cron` invoque el procedimiento en el contexto requerido, ni HTTP, TLS,
registros, caídas o el consumo concurrente del ticket en Supabase.

Fuentes: https://supabase.com/docs/guides/database/extensions/http y
https://www.postgresql.org/docs/17/sql-createprocedure.html

# Límites de ingreso

El código preparado limita atómicamente por identidad, código y presupuesto
global. No constituye un límite por IP: no se ha encontrado una garantía
oficial aplicable a Edge Functions alojadas de que una cabecera de origen no
pueda falsificarse en todas las rutas. El límite de Supabase Auth por IP limita
el alta de identidades anónimas, no los intentos de ingreso de identidades ya
existentes. El presupuesto global reduce el barrido distribuido, pero puede
agotarse y bloquear temporalmente a estudiantes legítimos. Supervisar los
errores 429 y ajustar los umbrales considerando redes compartidas de aulas.
