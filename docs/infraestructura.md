# Infraestructura independiente — evaluación 2026-11-03

La organización «Proyecto SIDE» cotizó un proyecto adicional en US$ 0/mes, pero Supabase rechazó su creación por el límite de proyectos gratuitos activos de un administrador. No se modificaron proyectos existentes.

Una alternativa a evaluar es Neon: su [plan gratuito](https://neon.com/blog/neon-free-plan-1-gb-per-project) anuncia PostgreSQL y Managed Better Auth con límites de uso. Es necesario conectar una cuenta, confirmar cuotas y permisos reales, integrar la autenticación y verificar un mecanismo confiable para los cierres. No hay un proyecto Neon conectado en este entorno.

El [servicio gratuito de Render](https://render.com/docs/free) se suspende tras 15 minutos sin tráfico, y su PostgreSQL gratuito caduca a los 30 días. Esto no satisface por sí solo la ejecución y persistencia exigidas. Su documentación también describe posibles costos adicionales de ancho de banda.

Ninguna opción se ha contratado ni desplegado. El servidor actual solo acepta una base local y no debe exponerse a Internet. Una publicación requiere autenticación administrada, autorización, sesiones y HTTPS verificados, límites compartidos adaptados al proveedor y un programador independiente del navegador. La migración SQL local no es una configuración segura de Supabase Auth o RLS. No se debe conectar a la base de SIDE original.

## Actualización: Neon conectado

Se creó un proyecto independiente SIDE-LITE en el plan gratuito y una rama de desarrollo con Auth administrado. Las nueve tablas y los doce eventos están preparados en esa rama. Todavía falta integrar la aplicación, la autorización y el cierre alojado; consulta `remote/README.md`. No hay URL pública de juego.

## Integración de desarrollo y cierre alojado

El puente local autentica solicitudes con Neon Auth y trabaja contra la rama de desarrollo mediante un rol SQL limitado. Se probaron partidas remotas de tres y seis ciclos y un ciclo de 120 segundos. La función `sideclose` fue probada con un disparador por minuto; está desactivado para preservar cuota. La aplicación pública y la integración del cliente oficial siguen pendientes; ver `remote/README.md`.

## Política institucional vigente

La rama Neon de desarrollo exige verificación por código. El servidor permite activar el rol docente, sin aprobación individual, solo para una identidad verificada cuyo correo termine exactamente en `@upch.pe`. El acceso estudiantil permanece separado. La entrega real del código, el cliente y el backend públicos siguen pendientes; no se han habilitado ciclos periódicos permanentes.
