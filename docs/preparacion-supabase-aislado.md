# Preparación de un Supabase independiente para validación

Estado: análisis local; no se ha creado ni modificado ningún proyecto. Este documento no es una autorización ni un procedimiento para ejecutar migraciones o cambiar la seguridad de un proyecto existente.

## Aislamiento y dependencias

La prueba debe usar un proyecto nuevo y vacío, con identificador, Auth, cuentas, bases, claves y funciones propios. No copiar una rama que herede usuarios, sesiones, datos, secretos, funciones o tareas programadas del proyecto actual. Antes de escribir, comprobar por separado la identidad del proyecto de destino, su titularidad, estado vacío, región y límites aplicables. Usar solo cuentas y partidas de prueba y mantener registro de los recursos creados.

La cadena candidata está en `supabase-side-lite/supabase/migrations/` (27 archivos, en orden de nombre). Incluye esquema, seguridad de identidad, roles de servidor, admisión, sesiones invitadas, podio y tickets de cierre. No aplicar la cadena sin resolver primero la incompatibilidad docente descrita abajo y revisar el efecto efectivo de cada migración. En particular, `20261110195138_side_lite_one_time_scheduler.sql` crea una tabla privada de tickets; no demuestra por sí sola que exista o sea seguro un programador activo. No ejecutar `supabase-side-lite/scheduler/install-cron.sql`: contiene una URL y una aprobación ligadas al proyecto actual y requiere una revisión separada del mecanismo y la exposición de credenciales.

Las entradas Edge son `supabase-side-lite/supabase/functions/side-lite-api/index.ts` y `supabase-side-lite/supabase/functions/close-cycle/index.ts`; importan su implementación bajo `supabase-side-lite/functions/`. La API usa `api/app.js`, el motor `js/engine.js`, el verificador JWT y dos conexiones distintas. El cierre manual usa el trabajador a través de la API; el endpoint `close-cycle` consume tickets de un solo uso para el barrido. El empaquetado y los imports deben verificarse en el entorno elegido antes de cualquier despliegue. `config.toml` desactiva el control JWT del gateway: la API verifica JWT y sesiones internamente; el trabajador exige un ticket. No asumir que el gateway protege esos endpoints y comprobar ambos controles reales.

Las conexiones de API y cierre necesitan credenciales y permisos separados, creados exclusivamente para el proyecto de prueba y administrados como secretos del servidor; nunca usar la clave de servicio en el navegador ni incluir contraseñas en Git, logs o capturas. El cierre exige CA y TLS verificado. Revisar los privilegios efectivos, RLS y membresías en el proyecto nuevo; el script `scripts/setup-supabase-local-logins.mjs` está limitado a un stack local y no es un procedimiento para un proyecto alojado. Revisar también Auth, correo de prueba, URLs de retorno, MFA, CORS, límite de acceso y retención antes de exponer el entorno.

## Bloqueo: autorización docente

`docs/aprobacion-docente.md` describe autorización individual y atribuida. Sin embargo, la migración posterior `20261110193520_automatic_institutional_teacher.sql` instala un trigger que concede acceso docente automáticamente al confirmar una cuenta `@upch.pe` y admite autorizaciones activas sin `granted_by`. Por tanto, esa documentación no describe el estado final de la cadena. No afirmar que aplicar todas las migraciones conserva la aprobación individual.

Para una cuenta docente segura se necesita resolver y revisar explícitamente la política final antes de aprovisionarla: una identidad de prueba con buzón controlado, confirmación de correo y una concesión atribuida a una segunda identidad administradora son el procedimiento descrito en `docs/aprobacion-docente.md`, pero no impiden por sí solos el trigger automático posterior. La solución de esquema, su orden y las pruebas de permisos deben revisarse específicamente; este análisis no cambia políticas ni crea una migración. Las pruebas deben demostrar que una cuenta sin concesión no obtiene acceso docente, que el propietario autorizado sí puede operar y que otra identidad no puede actuar sobre su partida.

## Adaptación del destino

La aplicación actual fija de forma intencional el proyecto permitido: `public/supabase-client.js`, `public/supabase-session.js`, `public/services/lite-game-service.js`, `supabase-side-lite/api/identity.js`, `supabase-side-lite/functions/database-target.js` y `supabase-side-lite/functions/side-lite-api/index.ts`. El adaptador `supabase-side-lite/functions/side-lite-api/adapter.js` fija también el origen CORS. Una copia para el proyecto nuevo requiere una configuración o compilación separada, con el nuevo identificador y origen exactos y su propia clave publicable; debe seguir rechazando otros proyectos, conexiones, emisores JWT y orígenes. Verificar con pruebas positivas y negativas que no pueda dirigirse al proyecto actual o a SIDE Original. No sustituir estas comprobaciones por comodines ni aceptar URLs suministradas por el cliente.

`scripts/prepare-supabase-local-fixture.mjs` genera una copia para un stack CLI local y cambia deliberadamente transporte y validaciones para loopback; su salida declara que no es apta para despliegue. No usarla como paquete alojado. Tampoco usar la función o credenciales reales actuales para probar el cierre: el trabajador de barrido procesa ciclos vencidos de su base.

## Evidencia requerida antes de considerar el entorno listo

1. Verificar identidad y aislamiento del destino, cadena aplicada, advisors, privilegios efectivos, políticas y ausencia de tareas automáticas inesperadas.
2. Probar Auth y correo reales de prueba, sesión y revocación, denegación de acceso cruzado y concesión docente según la política revisada.
3. Con una partida creada exclusivamente para la prueba: guardar y confirmar decisiones de dos estudiantes, esperar 120 segundos, invocar el cierre docente, registrar HTTP y código sanitizados, comprobar una sola copia de cada resultado, caja e inventario FIFO, y comenzar el siguiente ciclo. Verificar concurrencia y recuperación sin tocar otras partidas.
4. Identificar versión y configuración realmente desplegadas de ambas funciones; comprobar un rechazo sin credenciales válidas. No activar barridos ni programación hasta revisar el diseño y sus credenciales por separado.
5. Distinguir estas comprobaciones de las suites de PostgreSQL aislado, que simulan Auth/JWT y no prueban Edge alojado ni correo real.
