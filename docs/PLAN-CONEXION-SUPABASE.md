# Preparación de conexión real de SIDE-LITE

Destino autorizado para lectura: proyecto Supabase `hwwwoblfpsqqrkxvclag`. Este documento no ejecuta cambios. SIDE Original es otro proyecto y queda fuera del alcance.

## Evidencia local

En un proyecto Supabase local exclusivo con Auth anónimo, TOTP, base PostgreSQL, API y cierre Edge:

- Se aplicaron todas las migraciones de `supabase-side-lite/supabase/migrations` a un esquema nuevo. La migración `20261109204458_restrict_legacy_tables.sql` se comprobó también contra cuatro tablas heredadas creadas en una transacción local, verificando RLS y revocación de permisos de tabla y columna.
- El ingreso de dos invitados, recuperación, decisiones, resultados, clasificación y podio se comprobaron en móvil y escritorio para tres y seis ciclos con plazos adelantados. El primer recorrido de escritorio con un plazo real de 120 s cerró con todas las páginas cerradas y produjo resultados; una ronda posterior recibió `Failed to fetch` durante reinicios repetidos de la función local. Un segundo recorrido de escritorio con plazos adelantados pasó las dos partidas completas después de estabilizar el entorno.
- Auth TOTP real elevó la sesión a AAL2; la API y las políticas RLS se verificaron con AAL1 y AAL2 en base aislada. Se comprobó el cierre automático programado local mediante pg_cron, pg_net y Vault con `scripts/test-supabase-cron-local.mjs`.

Los cierres adelantados no acreditan tiempos reales de red ni el programador alojado. Los tests no sustituyen la validación del entorno remoto ni un ensayo de abuso y concurrencia.

## Inventario remoto de solo lectura

El 9 de noviembre el proyecto tenía cuatro tablas heredadas públicas sin RLS con permisos de lectura/escritura de `anon` y `authenticated`: `lite_sessions`, `lite_auth_limits`, `lite_teacher_grades`, `lite_teacher_podium`. La migración restrictiva ya preparada deniega acceso directo, pero aún no está aplicada. No conectar usuarios reales mientras continúe esta exposición.

El inventario remoto no devolvió funciones Edge. El cliente apunta a `side-lite-api`; por ello no hay API de partidas en la ruta prevista. El historial remoto contiene migraciones locales antiguas, mientras que el entorno de pruebas se creó desde cero con otra secuencia. Las funciones privadas `api_identity`, `api_create_profile`, `api_lock_teacher`, `api_mfa_ready`, `api_find_guest_join` y `api_recover_guest` no estaban presentes en la consulta. No se debe ejecutar la migración inicial de creación sobre las tablas existentes ni hacer `db reset`.

## Secuencia propuesta, pendiente de verificación y autorización

1. Corregir primero las cuatro tablas con la migración restrictiva, contrastar permisos efectivos de tabla y columna y repetir el asesor. Esto afecta el proyecto remoto y requiere autorización. Preparar una reversión y revisar accesos legítimos antes de ejecutar.
2. Comparar catálogo completo, propietarios, funciones, índices, RLS, políticas y datos del remoto con el esquema probado. Preparar una migración incremental específica que preserve los perfiles existentes y no recree tablas. Probar esa migración contra una copia aislada del esquema; la migración inicial de cero no es adecuada para el remoto existente.
3. Revisar protección por IP de creación de sesiones anónimas, límites compartidos de ingreso y recuperación, política de retención y recuperación de claves. El límite actual por identidad no impide que se creen identidades nuevas para eludirlo. Sin estas medidas no habilitar invitados en el proyecto alojado.
4. Preparar roles e identidades de base separados para API y cierre, verificar membresías, TLS, propietarios y privilegios mínimos. Configurar `SIDE_API_DATABASE_URL`, `SIDE_CLOSER_DATABASE_URL` y `SIDE_CLOSER_SECRET` exclusivamente como secretos del proveedor; nunca en el navegador o Git. Conceder profesores únicamente mediante aprobación institucional explícita.
5. Desplegar `side-lite-api` y `close-cycle` desde `supabase-side-lite/supabase/functions` y aplicar su configuración `verify_jwt=false` solo junto con las validaciones internas de JWT/secretos ya probadas. El gateway debe permitir OPTIONS restringido al origen de Pages. Confirmar respuestas y denegaciones cruzadas antes de habilitar el tráfico.
6. Instalar un cierre programado durable. `supabase-side-lite/scheduler/install-cron.sql` es una propuesta para pg_cron/pg_net/Vault, probada con destino sustituido localmente. Requiere extensiones disponibles, dos secretos independientes en Vault, revisión del acceso a la cola `net.http_request_queue`, latencia, coste, alertas y prueba de recuperación. La documentación de Supabase advierte que pg_net almacena temporalmente cabeceras en la cola de solicitudes. No activar sin revisar esos permisos.
7. Ejecutar en el servicio alojado una partida controlada con docente autorizado y dos invitados, validando autenticación, sesión/revocación, separación entre empresas, decisiones, plazo real con navegadores cerrados, resultados, podio, abuso y monitorización. Solo después retirar el aviso de Pages.

La aprobación de despliegue deberá especificar escrituras en el proyecto Supabase, creación de roles y secretos, despliegue de dos funciones y activación del programador. Esta preparación no los ha realizado y la migración incremental del esquema remoto sigue pendiente de elaborarse y probarse.
