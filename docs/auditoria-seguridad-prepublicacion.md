# Revisión de seguridad de SIDE-LITE — 7 de noviembre de 2026

Ámbito: revisión estática de la copia aislada, sus funciones remotas, migraciones y pruebas; no se accedió a Neon ni se ejecutaron cambios en servicios externos. Esta revisión no es una certificación de seguridad ni una prueba de penetración.

## Controles identificados

- El BFF de desarrollo exige acceso de vista previa, utiliza HTTPS, cifra la sesión en cookie HttpOnly/Secure/SameSite=Strict y verifica origen y JSON en mutaciones.
- La API privada exige una clave de vista previa y JWT firmado; consulta el estado actual de la identidad, comprueba pertenencia de partidas y habilitación docente y limita mutaciones autenticadas en PostgreSQL.
- El servidor de desarrollo local restringe su base y enlace a loopback; no debe publicarse.
- El registro público de la vista previa está deshabilitado y el BFF fija el origen y los hosts de Neon de desarrollo. Esos controles son parte del aislamiento actual: no desactivarlos para publicar sin sustituirlos por una arquitectura y controles equivalentes probados.

## Corrección preparada localmente

Se añadió `remote/migrations/202611070001_teacher_function_privileges_dev.sql`: revoca el permiso EXECUTE por defecto del rol PUBLIC para funciones SECURITY DEFINER relacionadas con docentes y deja los permisos necesarios al rol API. No se ha aplicado ni probado contra PostgreSQL o Neon. Antes de aplicarla, verificar orden, propietario, herencia de roles y pruebas negativas con un rol sin privilegios en una base aislada.

## Bloqueos antes de producción

1. Los límites de acceso del BFF son por instancia y correo; falta protección perimetral y límites compartidos contra abuso de autenticación, registro, recuperación, tráfico anónimo y agotamiento de recursos. Los límites de mutaciones autenticadas no cubren estas vías.
2. La activación docente permite actualmente que cualquier cuenta verificada de `@upch.pe` obtenga el rol por sí misma. Confirmar si esta política representa la autorización institucional deseada; si no, implementar concesión explícita y revocación administrativa auditables. El dominio de correo por sí solo no identifica necesariamente a un docente.
3. La integración de Neon Auth usa endpoints HTTP y manejo de cookies propios, no un SDK de servidor revisado. Validar con documentación vigente, pruebas de revocación y renovación, verificación de correo y entrega SMTP reales. Mantener secretos solo en el gestor del servicio y rotarlos si se sospecha exposición.
4. La cuenta de base de la API tiene permisos sobre tablas completas y depende de controles del servidor; verificar inventario de privilegios, roles efectivos, acceso directo desde Internet y separación entre API y función de cierre. No asumir que existen políticas RLS.
5. Ejecutar pruebas negativas de roles, acceso cruzado entre partidas, manipulación de cookies, CSRF, fuerza bruta distribuida, concurrencia, vencimiento, logout y revocación en el entorno aislado. Revisar dependencias y alertas con una instalación limpia y herramientas actualizadas.
6. Definir política de datos personales, conservación, recuperación, registros sin secretos, supervisión de errores, copias y restauración. Verificar headers, TLS, origen canónico y configuración de proxies del proveedor elegido.
7. Las funciones y migraciones existentes están diseñadas para la rama Neon de desarrollo. La identificación y el aislamiento de una futura base de publicación deben verificarse explícitamente. No ejecutar SQL sobre SIDE1.

Los secretos de desarrollo y los artefactos temporales se excluyen mediante `.gitignore`; esto no sustituye una revisión del contenido preparado y de los cambios antes del primer commit y antes de cada push.

## Política propuesta de acceso docente

Se preparó `remote/migrations/202611070002_teacher_grants_dev.sql` para que una cuenta con correo `@upch.pe` verificado también necesite una autorización explícita de un administrador de SIDE-LITE. Una autorización desactivada impide acceder como docente en la siguiente solicitud; no elimina la cuenta ni sus partidas. La tabla no es accesible al rol API. Esta medida cambia la política previa de autoactivación y requiere aprobación institucional, un procedimiento seguro de alta y revocación, y pruebas con roles reales antes de su uso. No se ha aplicado a Neon. La política exacta para profesores de otros dominios también queda pendiente.

En pruebas con proveedor simulado, un usuario con correo sin verificar no puede solicitar el token de acceso al juego y recibe 403. Esto no comprueba la entrega real del correo ni los contratos o la operación actuales de Neon Auth.
