# Plan de migración independiente a Supabase

Estado: **diseño pendiente de implementación y validación**. Este documento no acredita una integración funcionando ni autoriza cambios en SIDE original, Neon o producción. La aplicación web también necesita alojamiento HTTPS propio. No se ha aplicado ninguna migración Supabase para esta propuesta.

## Punto de partida comprobable

- `js/engine.js` contiene el cálculo compartido de cierre y ranking; debe seguir siendo la fuente de las fórmulas. `tests/engine.test.js`, `tests/closing.test.js` y `tests/laboratory.test.js` sirven como regresión inicial, no prueban Supabase.
- `server/index.js` implementa API local, autenticación propia y operaciones de partidas. `server/database-url.js` restringe deliberadamente la base a localhost; no eliminar esa protección para conectar Supabase. `server/close-cycle.js` cierra transaccionalmente y recupera ciclos vencidos mientras el servidor está disponible. Su lógica es referencia, no un servicio cloud ya instalado.
- `supabase/migrations/202611030001_lite_local.sql`, `202611030002_auth_limits_local.sql` y `202611090001_local_cycle_control.sql` son para el servidor local. Aunque su carpeta se llame `supabase`, contienen contraseñas/sesiones propias y carecen de políticas de Supabase Auth; **no aplicarlas directamente a un proyecto expuesto**.
- `remote/` contiene la implementación y migraciones específicas de Neon de desarrollo, incluido un BFF y cierre separados. Conservar esos archivos y sus salvaguardas; no apuntar a SIDE original ni modificar recursos Neon. Los resultados históricos de `remote/README.md` no prueban esta migración.
- Las API local y remota ahora rechazan nuevas partidas con duración distinta de 120 segundos; las partidas existentes conservan su valor. La futura ruta Supabase también debe imponerlo en servidor y base de datos, sin confiar en el navegador.

## Arquitectura propuesta

1. Un proyecto Supabase **nuevo y exclusivo para SIDE-LITE**, identificado explícitamente antes de escribir. Supabase Auth gestiona registro, inicio, recuperación y cierre de sesión. Configurar redirecciones y correo real en el entorno de pruebas; la verificación `upch.pe`, cuando corresponda, no concede funciones docentes por sí sola.
2. Perfil enlazado a `auth.users.id`, con autorización docente mantenida exclusivamente mediante una concesión administrativa independiente y auditable. Nunca derivar privilegios de `user_metadata` editable. Definir el procedimiento para conceder y revocar docentes antes de habilitar esa función.
3. Tablas adaptadas para partidas, empresas, ciclos, decisiones y resultados, con restricciones de integridad equivalentes a las existentes: código único, una empresa por estudiante y partida, un ciclo abierto, una decisión y un resultado por empresa y ciclo. Crear migraciones nuevas revisadas, con RLS en todas las tablas expuestas y concesiones mínimas. Mantener semillas de ciclo y decisiones privadas fuera de respuestas públicas; revisar vistas y funciones privilegiadas.
4. Operaciones de creación, incorporación, decisiones y control mediante una API protegida o Edge Functions que comprueben identidad, rol, propiedad y pertenencia. La base debe imponer las invariantes aun ante llamadas simultáneas. No confiar en UUID, reloj ni rol proporcionados por el navegador. La clave pública es apta para frontend; claves secretas y de servicio solo se guardan en el entorno servidor.
5. Preservar las operaciones económicas y las cuatro decisiones de `js/engine.js`; adaptar el módulo para compartirlo con el entorno de ejecución elegido y comparar resultados con los fixtures existentes. No duplicar fórmulas sin pruebas de equivalencia. El laboratorio debe ejecutar simulaciones aisladas sin escribir partidas ni exponer semillas o resultados futuros.
6. Guardar inicio y vencimiento oficiales mediante el reloj de PostgreSQL. Bajo bloqueo transaccional, rechazar decisiones vencidas, pausadas o ya confirmadas. La reanudación debe desplazar el vencimiento por el tiempo pausado. El cierre anticipado y el vencimiento comparten el mismo mecanismo idempotente de cierre.
7. Programar un barrido de ciclos vencidos o solicitados, con recuperación tras interrupciones, exclusión mutua, resultado único y aislamiento de fallos por partida. Cron puede ejecutarse después del instante de vencimiento: la recepción de decisiones debe cerrarse exactamente por el timestamp, independientemente de cuándo termine el cálculo. Revisar cuotas y coste antes de elegir frecuencia y mecanismo; no depender de navegadores conectados.
8. Evaluar Realtime solo para eventos autorizados de cada partida; no emitir saldos, inventarios, decisiones o semillas a participantes no autorizados. El cliente debe volver a consultar el estado oficial al reconectar, pues las notificaciones no sustituyen la persistencia.
9. Mantener la experiencia existente y conectar los adaptadores de sesión y juego. La réplica visual del acceso y panel docente debe cotejarse contra SIDE original de solo lectura; no se considera completa hasta verificar cada apartado funcional.

## Secuencia de trabajo

1. Preservar los cambios locales de `codex/replica-side-original` y trabajar en una rama distinta. Inventariar migraciones, dependencias y componentes de interfaz antes de adaptar el código.
2. Confirmar organización, región, costo y propósito de pruebas del proyecto nuevo. Verificar su identidad y que no sea SIDE original antes de crear o aplicar nada. No hacer operaciones destructivas ni de producción.
3. Crear migraciones específicas de Supabase mediante la CLI y revisar el SQL, roles, `GRANT`, RLS, índices, políticas y funciones. Probar en base PostgreSQL y entorno Supabase aislados. No importar contraseñas ni sesiones locales; definir expresamente la estrategia de identidad y datos existentes antes de migrarlos.
4. Implementar Auth, autorización docente, adaptador de juego y cierre con mínimo privilegio; conservar Neon y pruebas anteriores. Ejecutar los asesores de seguridad y revisar manualmente funciones `SECURITY DEFINER`, `search_path`, vistas, exposición y permisos.
5. Configurar correo, URL de retorno y origen HTTPS de prueba; ejecutar las pruebas siguientes y registrar evidencia reproducible. Solo después preparar instrucciones de publicación; push a `main`, despliegue público y cambios de producción requieren autorización.

## Matriz de aceptación pendiente

Cada caso requiere registrar entorno, versión, fecha, duración, resultado y evidencia. Un timeout, proveedor simulado o prueba previa en Neon/PGlite no demuestra funcionamiento real en Supabase.

| Área | Evidencia requerida en entorno independiente |
| --- | --- |
| Identidad | Registro y confirmación de correo real, inicio, recuperación y cierre de sesión; rechazo de sesión revocada y correo no verificado según política. |
| Docentes | Autorización administrativa explícita, revocación, rechazo de estudiante, docente ajeno y usuario de dominio institucional sin concesión. |
| Partida | Código único válido e inválido, ingreso de dos estudiantes, aislamiento entre partidas, asignación de tienda y capital en múltiplos de S/ 10 000. |
| Simulación | Partidas completas de 3 y 6 ciclos con decisiones desde ambas interfaces, cuatro decisiones, confirmación única, eventos, FIFO, resultados y ranking comparados con fixtures del motor. |
| Tiempo y recuperación | Ciclos reales de 120 segundos, rechazo al vencimiento por reloj servidor, cierre sin navegadores, reinicio/interrupción y recuperación, dos trabajadores concurrentes sin resultados duplicados, pausa y reanudación. |
| Seguridad | RLS y permisos con dos partidas, acceso cruzado, escrituras directas no autorizadas, privacidad económica, intentos de suplantación, claves expuestas y carrera de revocación. |
| Docente y presentación | Laboratorio sin efectos laterales, controles de ciclo, informes, exportaciones, notas y herramientas efectivamente existentes en SIDE original; capturas de estudiante y docente en escritorio y móvil. |
| Operación | Cuotas y costo del programador, observabilidad de fallos, copias y recuperación, y reconexión Realtime. |

Las pruebas automáticas existentes se conservan; deben ampliarse para Auth y Supabase reales. Las pruebas contra proveedores controlados son útiles para regresión, pero deben identificarse como tales. No declarar terminada la integración hasta completar el recorrido real desde autenticación hasta resultados finales.
