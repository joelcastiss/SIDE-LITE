# Pruebas locales preparatorias de SIDE-LITE

Estas pruebas usan PostgreSQL 17 desechable y una **emulación** mínima de
`auth.users`, `auth.sessions`, `auth.uid()` y roles. No prueban Supabase Auth,
Data API, políticas de red, JWT reales, Realtime ni un proyecto remoto.

Para un stack Supabase CLI desechable diferente, el script
`scripts/test-supabase-rls-local.mjs` prueba Auth, confirmación por el buzón
local y Data API con JWT reales. Exige la configuración y puertos de
`side-lite-supabase-stack-verify`, `SIDE_TEST_DISPOSABLE=YES`,
`SIDE_TEST_LOCAL_ANON_KEY` y `SIDE_LOCAL_POSTGRES_URL`. Crea y elimina solo
fixtures propios; no debe apuntar a un proyecto alojado ni compartido con datos
reales. Esta prueba no valida correo externo ni la configuración hospedada.

Desde la raíz de SIDE-LITE, en PowerShell, con Docker disponible:

```powershell
docker run --name side-lite-local-test --rm -d -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=side_lite_supabase_test -p 127.0.0.1:55469:5432 postgres:17-alpine
$env:SIDE_TEST_DISPOSABLE='YES'
$env:SIDE_LITE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55469/side_lite_supabase_test'
node scripts/test-supabase-isolated.mjs
docker stop side-lite-local-test
```

Esperar a que PostgreSQL esté listo antes de ejecutar el script. El script exige
un clúster vacío porque crea roles globales, aplica todas las migraciones y
ejecuta las pruebas de permisos y de partidas de tres y seis ciclos. Utilizar
un contenedor exclusivo y un puerto local libre. El método `trust` es únicamente
para este entorno desechable y no debe usarse en producción. El test de API se
conecta como superusuario y simula JWT; no acredita mínimo privilegio ni un
limitador distribuido real. El test RLS cambia a roles `authenticated` y `anon`.

La migración está **pendiente de revisión y no está lista para aplicar en
Supabase**. La API de creación y unión no está conectada a un servicio desplegado;
el limitador durable preparado necesita ensamblarse y probarse con permisos mínimos,
además de protección por IP en un proxy confiable, las operaciones
de pausa/reanudación y consulta, y pruebas de concurrencia con Supabase real.
Las rutas locales de inicio y decisión se probaron con Auth simulado, incluida
la competencia de dos confirmaciones y el rechazo de una decisión vencida; no
se probaron ciclos reales de 120 segundos de extremo a extremo. El cierre y
las credenciales de servicio requieren revisión y despliegue separado. No se
han aplicado cambios a ninguna base remota.

La prueba RLS incluye dos estudiantes en una misma partida: comprueba que cada
uno solo vea sus propias decisiones y resultados, que no pueda escribir saldos,
decisiones ni resultados directamente ni concederse permisos docentes, y que
el docente autorizado sí vea ambos. También verifica aislamiento entre partidas
y revocación docente. En PostgreSQL 17 local se ejecutó sin errores; las cuentas
y `auth.uid()` están simulados y esto no valida Supabase Auth ni Data API reales.

La prueba local también comprueba que `service_role` pueda bloquear concesiones docentes para verificar autorización, pero no crearlas, revocarlas, cambiarlas ni borrarlas. Se probó con roles y Auth emulados; no acredita permisos efectivos ni membresías en Supabase real.
