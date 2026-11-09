# Revisión de preparación: SIDE-LITE y Supabase

Estado: **preparación incompleta; no aplicar ni desplegar**. Proyecto previsto: `hwwwoblfpsqqrkxvclag`. El SQL se preparó localmente y no se aplicó al proyecto remoto. No se modificó SIDE original ni Neon.

## Controles preparados

- Migración propia con tablas, claves foráneas de partida, unicidad de decisiones y resultados, RLS y restricciones iniciales. Las semillas y concesiones docentes están en esquema privado. El plazo inicial se fija usando el reloj de PostgreSQL.
- La identidad preparada verifica firma, emisor, audiencia y vigencia del JWT; la autorización docente procede de una concesión de base de datos vinculada a correo confirmado, no del dominio ni de metadatos editables.
- Operaciones parciales para crear partidas, unirse por código, iniciar ciclos y enviar decisiones; el cierre preparado utiliza el motor económico existente y una transacción con bloqueo. Hay un limitador persistente de intentos por cuenta, aún sin ensamblar en un servicio desplegable. No hay despliegue ni programador activos.
- Las políticas pretenden limitar empresas, decisiones y resultados a su dueño o docente autorizado. La visibilidad del ranking necesita una proyección segura específica.

## Bloqueos antes de aplicar o activar

1. Falta el ensamblaje integral de la API de juego y las rutas de lectura y proyecciones, pausa, reanudación, finalización y ranking. La validación de plazos y el bloqueo común deben aplicarse a todas las rutas.
2. Falta integrar el limitador persistente en el servicio y limitar también abusos desde la red sin confiar en cabeceras del cliente. La ventana fija de cinco minutos permite una ráfaga en el cambio de ventana.
3. Falta integrar el SDK real, recuperación en la interfaz, aprovisionamiento de perfiles, correo, URL HTTPS, revocación y configuración de sesiones. Verificar algoritmos JWKS y semántica de `auth.sessions` en Supabase real.
4. Revisar funciones `SECURITY DEFINER`, `search_path`, grants, acceso a `auth.users` y `auth.sessions`, y el rol mínimo para la API y el cerrador. El uso de una credencial privilegiada exige autorización explícita dentro de cada operación y no sustituye RLS.
5. Faltan el despliegue del cerrador, configuración segura de Cron y secretos, monitorización, límites de ejecución y prueba de recuperación. El barrido puede ejecutarse después del plazo; la recepción de decisiones debe rechazarse desde el vencimiento oficial.
6. Comprobar que el empaquetado incluya el motor original y que los datos de eventos coincidan con él. Las decisiones y resultados deben conservar sus fórmulas, FIFO y ranking. Auditar también las dependencias de la interfaz y completar las herramientas docentes pendientes.
7. Pasar pruebas con Supabase Auth real, dos estudiantes y docente, acceso cruzado, llamadas directas maliciosas, carreras, ciclos completos de 3 y 6 rondas de 120 segundos, sin navegadores y con interrupciones. Ejecutar asesores de seguridad después de aplicar en un entorno autorizado.

## Evidencia local y límites

- Las pruebas del repositorio y del adaptador son pruebas de regresión; algunas usan dobles de Auth o base de datos y no acreditan servicios remotos.
- PostgreSQL 17 aislado con Auth y roles emulados verificó migración y casos básicos RLS. Otro ensayo local comprobó concurrencia y rollback del cerrador usando cierre anticipado. **No se esperó un ciclo real completo de 120 segundos ni se probó Supabase Cron, Edge o el entorno remoto.**
- La aprobación para aplicar remotamente no debe solicitarse hasta resolver los bloqueos pertinentes y revisar una versión concreta de las migraciones. Ninguna credencial debe aparecer en el frontend o en el repositorio.
