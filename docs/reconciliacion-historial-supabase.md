# Historial de Supabase y servidor local

El proyecto alojado ya tenía las cuatro versiones iniciales del servidor local,
pero el núcleo de Supabase se instaló fuera del historial antes de la actualización
incremental. Las quince versiones posteriores se registraron en el proyecto sin
estar en el directorio que utiliza la integración de GitHub. La cadena de
`supabase/migrations` recupera esos identificadores y sus operaciones históricas;
no requiere reparar ni modificar la tabla de historial del proyecto existente.

Para una instalación nueva, la primera migración reconstruye el núcleo previo a
la actualización cuando existe `auth.users`. Solo lo hace si no existe la tabla
de perfiles y falla si encuentra una instalación parcial. Un marcador privado y
temporal permite reproducir la instantánea de permisos que la actualización
incremental verifica; se elimina antes de ejecutar esa actualización. Los permisos
amplios de las tablas heredadas se revocan en la misma migración. En una base
existente con esas versiones registradas, Supabase no vuelve a ejecutar el SQL.

Las versiones históricas que instalaron y retiraron temporalmente la extensión
HTTP se conservan como operaciones vacías: su efecto final era ninguno y así no
se elimina una extensión ajena en una instalación nueva. El registro remoto de
`20261110200339` no conservaba sentencias; se usa el archivo de la implementación
correspondiente. La instalación del cierre SQL habilita `pg_cron` antes de crear
su trabajo en una instalación nueva. Los roles de conexión y sus credenciales
siguen siendo configuración específica de cada entorno; no se guardan en Git.
Una migración posterior incorpora la restricción de registros institucionales
que ya se probaba en la cadena aislada. Conserva las cuentas anteriores, incluso
si su correo no pertenece al dominio; rechaza nuevas cuentas y cambios de correo
no institucionales, y permite actualizar una identidad sin cambiar sus valores.

Las migraciones del servidor PostgreSQL local están en `server/migrations` y
`server/migrate.js` solo lee ese directorio. No se debe usar la cadena de Supabase
para migrar el servidor local ni aplicar manualmente las versiones ya registradas.
Los archivos de `supabase-side-lite/supabase/migrations` siguen siendo la cadena
de pruebas aisladas de Supabase; no todos sus identificadores forman parte del
historial alojado.

CI prueba la cadena aislada existente, reproduce el historial alojado en otro
clúster vacío y ejecuta la actualización histórica sobre una copia estructural
con perfiles, partidas, empresas, notas y podio de prueba. PostgreSQL puro no
incluye `pg_cron`, por lo que su instalación se verifica además con un stack local
de Supabase. La configuración Auth, los logins y los secretos deben verificarse
por separado en cada despliegue.
