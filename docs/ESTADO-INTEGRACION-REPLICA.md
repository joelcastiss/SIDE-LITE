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
