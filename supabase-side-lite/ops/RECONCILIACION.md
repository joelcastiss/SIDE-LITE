# Reconciliación y recuperación de SIDE-LITE

Este procedimiento está preparado para revisión; **no se ha ejecutado en el
proyecto remoto**. El único destino autorizado es `hwwwoblfpsqqrkxvclag`.
No se deben introducir contraseñas ni claves en este repositorio o en la
conversación. Las pruebas de escritura deben usar la instancia Supabase local
aislada autorizada, con identidad y destino comprobados y sin procesos heredados activos.

## Estado observado el 9 de noviembre de 2026

El historial remoto contiene `202611030001`, `202611030002`, `202611090001`
y `202611090002`, asociados al servidor local. También existen objetos del
core Supabase sin la versión `20261109020500` registrada. Se observaron las
tablas del core, sus políticas y los triggers `lite_create_student_profile` y
`lite_cycle_initialize`; esto **no prueba** equivalencia completa con el core.
Faltan `lite_join_attempt_windows`, `lite_games.ended_at`, la función
`lock_active_identity(uuid,uuid)` y los roles `side_lite_api` y
`side_lite_closer`. Cuatro tablas heredadas mantienen RLS desactivado y
permisos amplios. El inventario debe repetirse inmediatamente antes de operar.

## Comprobación reproducible

1. Confirmar referencia, rama y URL en Supabase; detenerse ante cualquier
   discrepancia. Guardar el listado remoto de migraciones y el commit local.
2. Crear un PostgreSQL desechable y ejecutar
   `node scripts/test-supabase-isolated.mjs` con las variables y restricciones
   documentadas en `../tests/README.md`. Para comparar el **core inicial**,
   preparar otra base vacía y aplicar únicamente el bootstrap de Auth y
   `20261109020500_side_lite_core.sql`; no usar un clúster compartido.
3. Ejecutar `schema-inventory-readonly.sql` sobre esa referencia y sobre el
   proyecto confirmado mediante una conexión de solo lectura. Guardar cada
   resultado en un lugar privado fuera de Git. El inventario incluye columnas,
   restricciones, índices, políticas, hashes de definiciones de funciones,
   triggers, ACL y membresías; no lee filas de estudiantes ni secretos.
4. Comparar objeto por objeto, incluidas firmas, propietarios, ACL, funciones,
   triggers, políticas, restricciones y columnas. Considerar las diferencias
   propias de plataforma y versión PostgreSQL; un hash o nombre coincidente por
   sí solo no demuestra equivalencia. Revisar además valores, relaciones y
   referencias de datos existentes sin exportar información personal a logs.
   Repetir el inventario tras cada paso aprobado. Si algo difiere de manera
   inexplicada, detenerse y preparar una migración incremental específica.
5. Inventariar por separado extensiones, configuración Auth, exposición Data
   API, funciones Edge, secretos existentes sin revelar sus valores, programador,
   grants y roles efectivos. Antes de probar en una rama, comprobar que ningún
   cron, webhook, función o variable apunte al proyecto padre ni a SIDE Original.

## Respaldo y reversión

Antes de cualquier cambio remoto, comprobar que existe un respaldo recuperable
de la base y que se puede restaurar en un destino aislado; registrar hora,
alcance y resultado de una restauración de prueba. Si se usa un volcado,
proteger por separado roles, esquema y datos, siguiendo la [guía oficial de
respaldo](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Un respaldo de la base no sustituye el inventario y respaldo de configuración
Auth, funciones, secretos, programadores, archivos y recursos externos. No
copiar secretos a Git ni registrar contraseñas en comandos o registros.

Ensayar cada migración y su recuperación en el entorno aislado. Ante un fallo,
deshabilitar el tráfico o los componentes nuevos cuando sea necesario y
conservar registros y datos; no relajar RLS o permisos para volver a habilitar
el servicio. Una transacción fallida se revierte completa. Tras una migración
confirmada, preferir una migración correctiva revisada que preserve datos; si
se necesita restauración, probarla primero en un destino nuevo y definir cómo
recuperar escrituras posteriores. No sobrescribir datos reales ni ejecutar
`DROP`, `TRUNCATE`, `migration repair` o una restauración destructiva como
atajo. En particular, no revertir el cierre de exposición de tablas heredadas
restaurando grants anónimos.

## Secuencia candidata, condicionada a verificación y autorización

1. En el entorno aislado reproducir la mezcla real de esquema e historial, no
   solo una instalación limpia. Aplicar y probar primero el endurecimiento de
   tablas heredadas `20261109204458_restrict_legacy_tables.sql`: conserva datos,
   niega acceso Data API y no implementa calificaciones ni podio para la nueva
   API. Comprobar que no existan consumidores autorizados que requieran esos
   accesos y que los roles efectivos no hereden grants adicionales.
2. No volver a ejecutar a ciegas `20261109020500_side_lite_core.sql`: sus
   `CREATE TABLE` y demás objetos ya existen. Solo tras demostrar equivalencia
   completa y ensayar el procedimiento en la réplica, revisar cómo registrar
   esa versión como ya aplicada. La operación de reparación de historial cambia
   metadatos, no crea objetos ni valida su contenido; jamás usarla para ocultar
   una discrepancia. Conservar también el registro de las cuatro versiones
   históricas; no marcarlas revertidas ni modificarlas sin una decisión explícita.
3. Comprobar las precondiciones de cada migración posterior y aplicar, en orden,
   las que realmente falten: limitador, terminación, seguridad de identidad,
   vistas históricas, bloqueo de identidad y roles. Sus sentencias no son
   universalmente idempotentes: volver a inspeccionar antes de cada aplicación.
   La creación de roles, su pertenencia y credenciales deben revisarse para el
   entorno alojado. Comprobar privilegios efectivos y que ningún rol de navegador
   pueda asumir los roles del servidor. La existencia de un objeto no basta para
   registrar como aplicada toda una versión.
4. Ejecutar asesores, pruebas positivas y negativas con JWT y sesiones reales,
   aislamiento entre partidas, revocación, bloqueo y expiración. Desplegar API y
   cierre solo tras verificar configuración, secretos y destinos; probar el
   programador sin navegadores, concurrencia, recuperación y ausencia de
   duplicados. Finalmente repetir la partida en Chromium y móvil con Auth real.

Los cambios remotos de impacto requieren la aprobación y el mecanismo seguro
indicados por el usuario. Este documento no autoriza ni ejecuta esas operaciones.
