# Ensayo de recuperación de SIDE-LITE

El respaldo lógico privado del 9 de noviembre de 2026 se ensayó en una instancia
Supabase local independiente (`side-lite-restore-proof-20261109`). El proyecto
remoto no se usó como destino de restauración. La copia contiene datos sensibles
y permanece fuera del repositorio.

## Dependencias y orden ensayado

El esquema `auth` del respaldo incluye el disparador
`lite_create_student_profile` sobre `auth.users`. Este invoca
`side_lite_private.create_student_profile`, que aún no existe al restaurar Auth
en PostgreSQL vacío. A su vez, las funciones y claves de SIDE-LITE dependen de
`auth.users`, `auth.sessions` y otras estructuras administradas de Auth.

Se inicializó primero una instancia local de Supabase con Auth y después se
restauraron los roles de SIDE-LITE y el esquema de la aplicación. Se importaron
los datos de Auth, seguidos de los datos de `public` y `side_lite_private`, y
se instaló el disparador de Auth. El archivo general de datos ya contenía Auth;
aplicarlo completo después del volcado específico de Auth produjo una clave
duplicada. Se separaron las secciones por esquema para evitar la doble carga.

Los permisos predeterminados de la instancia local concedían más acceso a tablas
que el remoto. Se revocaron esos permisos locales para `anon`, `authenticated`
y `service_role`, y se reaplicaron las concesiones del volcado. Esto debe ser
parte del procedimiento: reproducir los objetos sin reconciliar ACL no reproduce
la seguridad del origen.

## Comprobaciones y límites

Coincidieron los recuentos de 21 tablas, 20 políticas y 15 funciones en `public`
y `side_lite_private`, así como los dos usuarios y dos perfiles originales;
no había perfiles huérfanos, partidas ni concesiones docentes. Las 23 claves
foráneas de aplicación estaban validadas. RLS estaba activo en las tablas
públicas, y los privilegios de inserción de resultados de API y cerrador
coincidían con el remoto. Pasó la prueba local `postgres-rls-smoke.sql`.
También pasó la prueba de roles del servidor. Las pruebas de puente de Auth y
MFA pasaron con ajustes solo locales para la membresía de prueba y las columnas
obligatorias de la versión administrada de Auth; sus transacciones se revirtieron.
Se creó una sesión anónima local nueva mediante Supabase Auth, se consultó su
identidad y se comprobó la creación automática de su perfil. Esta prueba no
verifica las contraseñas ni las sesiones previas de las cuentas restauradas.

La copia lógica no es una imagen completa del proyecto Supabase. La recuperación
de configuración Auth, claves de firma, secretos de funciones, configuración de
red y facturación, funciones Edge, programadores, archivos de Storage y demás
recursos administrados requiere procedimientos adicionales. En la consulta del
ensayo, Storage no tenía buckets ni objetos y aún no había funciones Edge. No
se probó la restauración de datos binarios ni la recuperación de una sesión o
contraseña real existente. Las comparaciones de recuentos y la prueba RLS no
demuestran igualdad completa de contenido o ACL. Antes de usar esta copia como
única garantía de recuperación para cambios remotos, verificar esos aspectos y
disponer de un procedimiento de restauración y reconciliación apropiado para
el entorno administrado de destino.
