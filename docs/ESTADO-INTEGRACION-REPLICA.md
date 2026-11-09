# Estado de integración SIDE-LITE

Rama de trabajo: `codex/integracion-side-lite`, basada en `7267051`. Los cambios sin commit de las dos copias originales se preservaron; la copia Supabase incorporaba ya los cambios de réplica salvo diferencias revisadas en autenticación y duración. Ninguna de las copias originales fue modificada. Los residuos `.temp` y archivos `.env` quedaron excluidos.

| Área docente | Estado en integración | Pendiente |
|---|---|---|
| Configuración y creación | Creación y código con backend local | Estructura original completa y Supabase real |
| Rondas | Iniciar y cierre por tiempo local | Pausa, reanudación y cierre anticipado accesibles de forma segura con Supabase |
| Empresas | Participantes y confirmación | Gestión completa y herramientas docentes originales |
| Resultados | Resultados económicos y clasificación | Gráficos, informes y exportaciones del original |
| Laboratorio | Controles y CSS originales parcialmente adaptados; cálculo Lite independiente | Reproducir fielmente todos sus componentes, simulación y comparación |
| Podio | Ranking Lite | Notas, podio docente y publicación programada |
| Historial | Consulta parcial por partida | Interfaz y funciones completas |
| Autenticación | Adaptador Supabase y autorización preparados localmente | Auth, verificación de correo, sesiones y revocación reales sin probar |

Archivos originales SIDE1 reutilizados: `css/laboratorio.css`, copiado como `public/laboratory.css`; se reutilizan activos SIDE y partes de la estructura/clases de `docente.html`. `public/laboratory.js` y el panel están adaptados y no son copias íntegras del JavaScript original. Falta integrar los componentes originales restantes.

Pruebas ejecutadas en esta rama: 61 pruebas Node; empaquetado BFF; prueba Playwright del laboratorio con PostgreSQL 17 local; RLS y API Supabase con Auth emulado y PostgreSQL local; no demuestran seguridad ni autenticación de Supabase remoto. Las pruebas de ciclos largas se informan por separado tras terminar. No se han aplicado migraciones remotas; las migraciones Supabase no están listas para aplicar.

## Comprobación local de sincronización

Se incorporaron límites al tiempo de espera de actualización, descarte de respuestas anteriores y aislamiento de borradores por ciclo. Dos pruebas Playwright con API simulada comprobaron una respuesta bloqueada y tardía, dos sesiones y recuperación tras pérdida de red. Una partida real local de tres ciclos de 120 segundos con docente y dos estudiantes terminó correctamente y contrastó cada resultado con el motor económico. Una partida local de seis ciclos de 120 segundos también terminó correctamente, con docente y dos estudiantes, transiciones automáticas, decisiones, ranking y resultados contrastados con el motor económico. Estas pruebas no acreditan Supabase remoto.

La migración Supabase en preparación exige además dominio exacto @upch.pe y aprobación administrativa. PostgreSQL aislado con Auth emulado aprobó pruebas RLS y dominios inválidos; no aplicar hasta revisar privilegios efectivos y probar autenticación y cierre reales.

## Revisión local de herramientas y sincronización

El historial usa el módulo original `teacher_history.js` adaptado a resultados cerrados de Lite y añade exportación CSV con protección de fórmulas. Se comprobó en PostgreSQL local con dos estudiantes y cierres anticipados para partidas de 3 y 6 ciclos. El laboratorio reutiliza presentación original y conserva la simulación hipotética independiente; no implementa aún comparación histórica equivalente al original.

En una regresión se observó que un borrador guardado podía sustituirse por valores iniciales y que una confirmación registrada no aparecía en pantalla. Se prepararon correcciones y pruebas simuladas; una repetición real falló y otra instrumentada pasó. Hasta disponer de repetición consistente, no dar por cerrada la incidencia.

El borrador de Supabase limita permisos sobre concesiones docentes, pero Data API podría permitir lecturas con tokens no revocados si se expone directamente: resolver estrategia de revocación y validar roles reales antes de aplicar migraciones. Notas, podio docente, informes completos y controles remotos siguen pendientes.

## Herramientas docentes locales adicionales

Se integraron notas docentes y podio con publicación inmediata o programada, pausa, reanudación y cierre anticipado, informe PDF y CSV, historial y laboratorio. El docente propietario y la escritura de notas se comprueban en el backend local; el estudiante puede ver el podio publicado durante su vigencia. Playwright con PostgreSQL local verificó acciones docentes, aislamiento de nota, publicación y visualización del estudiante, PDF y partidas con cierre anticipado. Las rutas de notas, podio y ciclos adicionales son exclusivamente locales; no están implementadas en la API Supabase o Neon. La programación de podio y su caducidad se probaron por API local. El informe PDF no se ha comprobado desde un BFF remoto.

Las pruebas anteriores de sincronización registraron un fallo intermitente de presentación de confirmación tras guardarse en base; se prepararon regresiones y una repetición instrumentada pasó. Es necesario continuar investigando hasta asegurar su estabilidad. El panel y laboratorio aún no ofrecen la totalidad de funcionalidades ni la reproducción visual completa de SIDE1.
