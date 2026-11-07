# Propuesta de publicación independiente (revisión previa)

Este documento es un diseño de publicación, no un despliegue ni una promesa de que la vista previa esté lista para uso real. El repositorio no ejecuta despliegues automáticos. No se ha creado ni modificado ningún recurso remoto con esta preparación.

## Ruta de un mismo origen

1. Una función web SIDE-LITE sirve por HTTPS la interfaz compilada y el BFF desde el mismo origen. La configuración de ejemplo existente es exclusiva de desarrollo: `remote/bff-function.js` fija la rama y los hosts de vista previa, exige acceso adicional y bloquea el registro público. Esas restricciones son deliberadas. El SDK oficial de Neon Auth y su modelo de cookies requieren integración y prueba; simplemente cambiar hosts o desactivar la protección no es una solución de producción.
2. El BFF valida la sesión y el correo, protege las mutaciones frente a solicitudes de otro origen, y contacta a una función de API de SIDE-LITE. Esta verifica identidad y autorización por partida y usa solo un rol SQL con permisos mínimos. Las claves y cookies del proveedor no se incluyen en HTML ni en el repositorio.
3. PostgreSQL, Auth, funciones y programador tienen que pertenecer al proyecto SIDE-LITE y a ramas explícitamente identificadas; nunca se utiliza SIDE1. La rama de producción debe tener infraestructura y datos propios. Las ramas de Neon también pueden heredar datos y configuración de Auth: crear una rama no equivale a una base vacía. Antes de usar una rama de ensayo, verificar que su origen no tenga datos reales y que sus triggers estén deshabilitados; verificar endpoint, roles, Auth y proyecto antes de escribir.
4. La función de cierre procesa transacciones idempotentes sobre ciclos vencidos. Un trigger programado de Neon es una opción, pero hay que probar reinicios, retrasos, invocaciones duplicadas y simultáneas, fallos, recuperación y coste. La cadencia cron de un minuto no garantiza disponibilidad del resultado exactamente al segundo 120; registrar la latencia y fijar un objetivo aceptable antes del lanzamiento.

La construcción local existente genera tres módulos en `tests/output/`: `node scripts/build-bff.mjs`, `node remote/build-private-api.js` y `node remote/build-closing.js`. `.github/workflows/build.yml` repite esa construcción en cada cambio y comprueba sintaxis. Es integración continua de construcción, no automatización de despliegue; tampoco prueba por sí sola Auth, base de datos ni despliegues.

## Configuración segura futura

- Definir URL HTTPS, proyecto y rama dedicados; aprobar el origen y dominio de correo en Neon Auth y en el proveedor de correo; comprobar que OTP llega a un buzón de ensayo autorizado. Probar registro, sesión, renovación, cierre, revocación, expiración y acceso de docentes y estudiantes con las reglas acordadas.
- Definir por escrito quién puede activar rol docente. Un correo verificado bajo `@upch.pe` demuestra control de esa cuenta, no necesariamente que su titular sea docente. No habilitar acceso real hasta establecer el mecanismo de autorización.
- Reemplazar o auditar independientemente el proxy HTTP propio de Auth frente al SDK oficial; revisar CSRF, fijación y revocación de sesiones, límites compartidos, políticas de origen y cabeceras. Probar intentos de acceso cruzado y privilegios negativos.
- Configurar secretos solamente en el almacén de secretos del proveedor y con permisos mínimos. Usar entornos protegidos y aprobaciones en GitHub cuando exista el repositorio remoto. Nunca incluir contraseñas, conexiones, tokens ni claves en código, salidas o argumentos visibles de procesos. Definir rotación y respuesta a incidentes.
- Agregar automatización de despliegue únicamente después de escoger proveedor, configurar entornos y credenciales, y obtener autorización para publicar. Debe ejecutar pruebas, construir una versión identificable, exigir aprobación al promover a producción, restringir permisos por entorno y permitir reversión. Probarla primero en una rama de ensayo completamente aislada.
- Conservar un registro de versiones, migraciones aplicadas y respaldo; monitorear errores de cierre, edad del ciclo vencido más antiguo, latencia, consumo, disponibilidad y fallos de correo. Probar restauración y recuperación antes de permitir clases reales.

## Referencias oficiales

- [Neon Functions y ramas](https://neon.com/blog/neon-functions-backend-logic-next-to-your-data)
- [Triggers programados de Neon](https://neon.com/blog/your-neon-functions-can-now-run-on-a-schedule)
- [Neon Auth y estado por rama](https://neon.com/blog/neon-auth-branchable-identity-in-your-database)
- [Configuración de Neon como código](https://neon.com/blog/introducing-neon-ts)
- [Documentación de entornos protegidos en GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

## Control del trigger de desarrollo

El manejador del cierre se prueba localmente frente a métodos incorrectos, ausencia o desacuerdo de la cabecera de invocación, nombre de trigger inesperado y fallos internos. La validación de cabeceras depende específicamente del proxy de Neon Functions: el SDK informa que este elimina cabeceras `x-neon-*` de solicitudes externas. La prueba unitaria no valida la configuración del proxy ni sustituye una invocación real. No reutilizar el manejador bajo un proveedor diferente sin autenticación independiente y pruebas de acceso. El cierre programado sigue sin activarse ni validarse en una rama aislada.
