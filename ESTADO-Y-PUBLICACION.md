# SIDE-LITE: estado de separación

Esta carpeta es una copia independiente de `side-lite/` de `feature/side-lite` de SIDE1 (referencia local c4d10d6b8fc34d78e361a2f0f49ba46d02c67ae2). Se conservó el contenido de la copia de trabajo, incluso posibles cambios locales. No contiene el historial ni el remoto de SIDE1, credenciales locales, bases de datos, dependencias instaladas ni artefactos temporales de prueba. Se inicializó como repositorio Git local independiente, sin remoto.

## Componentes

- `public/`: interfaz multijugador, adaptadores de sesión, estilos y recursos.
- `server/`: servidor y autenticación de desarrollo para PostgreSQL local; solo acepta loopback y no es un backend de producción.
- `remote/`: API privada, BFF, identidad Neon, cierre y migraciones de desarrollo. La integración está restringida explícitamente a la rama y hosts de desarrollo; no cambiar esos controles sin revisar seguridad.
- `js/`, `css/`, `index.html`, `assets/`: versión de práctica y motor económico compartido.
- `tests/` y `e2e/`: pruebas unitarias y recorridos; los recorridos live requieren infraestructura y cuentas aisladas.
- `server/migrations/`: migraciones del servidor local. `supabase/migrations/` contiene el historial reconciliado del proyecto SIDE-LITE; ver `docs/reconciliacion-historial-supabase.md`.

## Estado y pruebas del 7 de noviembre de 2026

`npm test`: 28 pruebas aprobadas, con dependencias de la instalación local existente copiadas temporalmente y retiradas después. Cubren motor, marketing, eventos, inventario, identidad simulada y seguridad del BFF con proveedor controlado. `npm ci --offline` no pudo completarse por dependencias ausentes de la caché; una instalación limpia en línea sigue pendiente. No se ejecutó una partida multijugador integral en esta sesión: Docker no permitió conectar al motor y no se escribieron datos en Neon. `remote/README.md` documenta pruebas reales anteriores de dos estudiantes y docente en Neon; son evidencia histórica, no una nueva verificación. No se probó envío real de correo.

Se verificó que las referencias Git locales del proyecto original apuntaban a `main` 710d4f40e7bc1025a366987b721e46b00b466322 y `feature/side-lite` c4d10d6b8fc34d78e361a2f0f49ba46d02c67ae2, igual que la referencia local `origin/feature/side-lite`. No se pudo consultar el remoto por restricción de red. No se realizaron operaciones de escritura en SIDE1 ni en su base o publicación; no se puede certificar su estado remoto actual sin inspección adicional.

## Arquitectura y publicación

La vista previa existente sirve interfaz y BFF bajo el mismo origen: el adaptador usa rutas relativas, cookies `SameSite=Strict`, comprobaciones de origen y políticas CSP. GitHub Pages solo sirve archivos estáticos; colocar allí la interfaz y dejar el BFF en otro dominio requiere rediseñar sesiones, CORS/CSRF y CSP y probar todo de nuevo. La ruta de menor cambio es mantener frontend y BFF bajo el mismo dominio HTTPS y una API Neon de desarrollo separada. La función remota actual se limita a sus hosts de desarrollo y exige acceso de vista previa; no está lista para exposición pública. El servidor local no puede conectarse a Neon y no debe exponerse para sustituirla.

Faltan revisión independiente de seguridad de Neon Auth y BFF, registro y recuperación de cuenta, SMTP y verificación real de correo, límites de abuso distribuidos, política de roles y privacidad, URLs y secretos propios, configuración del dominio, cierre automático durable y recuperable aun sin navegadores, observabilidad, respaldo y recuperación, pruebas de carga y revisión de consumo. El programador de desarrollo está desactivado; no activarlo sin revisar coste y permisos. Neon ofrece triggers programados, pero su cadencia, fiabilidad y coste para cierres de dos minutos deben evaluarse con las cuotas vigentes. Render gratis suspende servicios inactivos y no asegura por sí solo los cierres.

## Pasos posteriores sujetos a autorización

1. Revisar esta copia y los cambios locales frente al commit, y comprobar que no contiene secretos antes de cualquier commit.
2. Instalar dependencias con `npm ci`, levantar PostgreSQL local aislado con `docker compose up -d`, configurar variables locales de `.env.example`, ejecutar `npm run migrate`, `npm test`, y pruebas E2E de docente y dos estudiantes, incluidas partidas de 3 y 6 ciclos y duración de 120 segundos. Nunca apuntar a SIDE original.
3. Acordar entorno y costes; usar exclusivamente el proyecto y rama Neon de SIDE-Lite, verificar identidad y aislamiento, y configurar el cierre durable y autenticación real. Repetir pruebas de punta a punta, revocación, permisos, concurrencia y recuperación.
4. Tras autorización expresa, inicializar Git, inspeccionar `git status` y el contenido, crear el repositorio GitHub `SIDE-LITE`, hacer el primer commit y push, configurar secretos como variables del proveedor y publicar en el alojamiento elegido. No agregar `.env`, bases ni artefactos de prueba.
5. Verificar el dominio público con dos estudiantes y un docente, cierre con navegadores cerrados y ausencia de impacto en SIDE original.

Fuentes: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site ; https://render.com/docs/free ; https://neon.com/docs/compute/functions/triggers/schedule

## Comparación y revisión adicional

Comparando con el árbol Git de la rama y normalizando finales de línea, todos los archivos originales coinciden con el commit; los únicos cambios de esta preparación son la advertencia en README, las reglas adicionales de `.gitignore` y este informe. La búsqueda automatizada de patrones comunes de credenciales solo señaló contraseñas de ejemplo para localhost y datos de prueba; debe repetirse una revisión antes del primer commit. No constituye una garantía absoluta de ausencia de secretos.

## Preparación adicional: 7 de noviembre de 2026

Se inicializó Git local sin remoto. La instalación limpia `npm ci --ignore-scripts --no-audit --no-fund` finalizó correctamente; `npm test` aprobó 29 pruebas y `npm audit` no reportó vulnerabilidades conocidas, incluidas dependencias de desarrollo. El empaquetado del BFF se ejecutó localmente. La auditoría y sus límites están en `docs/auditoria-seguridad-prepublicacion.md`.

Se corrigió la paginación del procesamiento de ciclos vencidos para que errores persistentes no oculten los ciclos de páginas posteriores; existe una prueba simulada de 100 fallos y un cierre posterior. Queda verificarlo con PostgreSQL real, concurrencia, límites de ejecución y un programador persistente. Se preparó una migración de privilegios para funciones docentes; no se ha aplicado ni probado contra una base real.

Se añadió `e2e/full-two-students-local.spec.js` para partidas de 3 y 6 ciclos con dos estudiantes y docente, y una configuración de GitHub Actions con PostgreSQL efímero para ejecutarla junto con las pruebas unitarias. La sintaxis de la prueba fue comprobada, pero ni la prueba E2E ni el flujo de Actions se han ejecutado: este equipo no pudo acceder al motor Docker y no hay PostgreSQL local disponible. La prueba usa ciclos acelerados de 8 segundos; la duración predeterminada de 120 segundos sigue requiriendo verificación integral.

El flujo de Actions es de pruebas, no despliega. La arquitectura de producción y el proveedor deben definirse y validarse; no hay configuración de despliegue automático de producción lista. El BFF de Neon continúa limitado a los hosts de desarrollo, con acceso de vista previa y registro público desactivado. No conectar ni migrar SIDE1 ni ninguna base no verificada.

## Continuación: PostgreSQL aislado y partidas

Docker Desktop denegó acceso a su motor. PostgreSQL 16.4 portátil se descargó en `work`, pero `initdb` quedó detenido en las comprobaciones del entorno, por lo que no se ejecutó con él. Como alternativa se usó PGlite en memoria, con el servidor limitado a loopback y un pool de una conexión. No se crearon ramas Neon ni se escribieron bases existentes. PGlite no demuestra la concurrencia ni el comportamiento de procesos, bloqueos y recuperación de PostgreSQL nativo.

En ese entorno se aplicaron las dos migraciones del servidor local y se completaron partidas de 3 y 6 ciclos con dos estudiantes y un docente; se comprobaron decisiones enviadas por API, evento, tiempos acelerados de 8 segundos, resultados privados y docentes, clasificación y pantalla docente. No demuestra que ambos estudiantes hayan completado cada decisión mediante la interfaz gráfica.

Se ejecutaron las migraciones docentes 004, 005, 070001 y 070002 en PGlite en memoria con `neon_auth` simulado. Pasaron las verificaciones de autorización explícita, revocación, correo sin verificar, cuenta bloqueada y denegación de permisos a un rol no privilegiado. La política propuesta de concesión explícita exige decisión y procedimiento institucional; no se ha aplicado a Neon. En otra prueba PGlite secuencial se comprobó que un cierre fallido no bloquea otro y que, tras reparar datos, el ciclo se recupera sin duplicar resultados; se omitió CREATE EXTENSION pgcrypto en esa ejecución. No se probó concurrencia real.

En el backend local, el cierre ahora usa transacciones por ciclo y evita solapar barridos. `npm test` aprobó 32 pruebas. La revisión de Neon Auth contra un proveedor simulado no valida OTP real, entrega de correo, sesiones de Neon desplegado ni integración con SDK oficial. Las automatizaciones GitHub de esta carpeta construyen y prueban, pero aún no despliegan. No publicar hasta resolver los bloqueos de `docs/arquitectura-publicacion.md` y `docs/auditoria-seguridad-prepublicacion.md`.

También pasó un ciclo de 120 segundos con dos estudiantes y sin páginas abiertas: los resultados coincidieron y se rechazaron decisiones posteriores. Pasó `e2e/restart.js`: el backend se detuvo durante el ciclo y, al reiniciar, procesó el ciclo vencido y conservó sesión y partida, con la base PGlite aún encendida. Esto no prueba la persistencia tras reiniciar la base. La prueba de ciclo real aumentó su plazo total para tolerar el arranque lento, sin cambiar la duración de 120 segundos.

El flujo CI incluye ahora la creación de dos bases efímeras separadas y pruebas de permisos y cierre concurrente con PostgreSQL, además de la prueba multijugador. El flujo está preparado pero todavía no se ha ejecutado en GitHub; su aprobación no debe asumirse. Las pruebas de 3 y 6 ciclos usaron decisiones por API, no interacciones completas de ambos estudiantes con formularios.

## Revisión con PostgreSQL nativo y primer commit — 7 de noviembre de 2026

Docker Desktop estuvo disponible y se creó un contenedor PostgreSQL 17.11 aislado, con datos efímeros y puerto limitado a loopback. Pasaron las migraciones locales y las pruebas SQL aisladas de permisos docentes (con Neon Auth simulado), y el cierre remoto con recuperación de errores, invocaciones concurrentes y ausencia de duplicados. Pasó el recorrido de tres ciclos con dos estudiantes y un docente contra PostgreSQL. En las pruebas de seis ciclos y de 120 segundos se agotó el plazo; Docker y consultas nuevas a PostgreSQL también dejaron de responder. No se determina si hay un defecto de aplicación o del entorno. Las pruebas de seis ciclos y 120 segundos anteriores sí pasaron con PGlite, pero no sustituyen la validación PostgreSQL.

Pasaron 34 pruebas unitarias y `npm audit` no reportó vulnerabilidades conocidas. Se añadieron pruebas para la validación de invocaciones del cierre; esa validación depende de que el proxy Neon quite las cabeceras internas suministradas por clientes y requiere comprobarse en infraestructura real. El programador de producción aún no está configurado ni validado. La propuesta actual sigue restringida a Neon de desarrollo y no puede publicarse como producción sin revisar autenticación y configuración.

Se revisaron patrones comunes de secretos y cuatro valores privados de desarrollo contra el índice sin coincidencias. Se excluyeron bases locales, secretos y artefactos generados; las contraseñas incluidas son ejemplos para localhost o CI. La revisión automática no garantiza ausencia total de secretos. Se añadió la licencia de Poppins; falta confirmar derechos del logotipo. No se creó ni modificó ningún recurso remoto, ni se aplicaron migraciones a Neon. GitHub Actions aún no se ha ejecutado.

La prueba de reinicio del backend pasó con PostgreSQL real: el ciclo vencido se cerró al reiniciar y persistieron la sesión y la partida. PostgreSQL permaneció encendido.

## Revalidación del 8 de noviembre de 2026

El repositorio local permaneció limpio en el commit 72b1130; no tiene remoto. Se comprobó mediante acceso de solo lectura la cuenta GitHub joelcastiss y el proyecto Neon SIDE-LITE (odd-dust-54712578). La rama side-lite-dev tiene el trigger de cierre desactivado y un proveedor de correo compartido. No se han creado recursos remotos ni se han aplicado migraciones a Neon.

Pasaron nuevamente 34 pruebas unitarias. Con PostgreSQL 17 efímero local se aplicaron las migraciones locales y pasó la partida de tres ciclos. La partida de seis ciclos no pasó: excedió el tiempo de prueba durante pausas prolongadas del equipo; el ciclo de 120 segundos tampoco pasó, al recibir ECONNRESET. No hay evidencia suficiente para atribuir esos fallos a la aplicación o a la infraestructura. No se completó la prueba integral de los formularios de estudiantes. Se detuvieron y retiraron los recursos temporales creados para la prueba. Sigue pendiente validar seis ciclos, 120 segundos y concurrencia bajo condiciones estables, así como Neon Auth y correo real.

## Preparación de vista previa aislada

La inspección de solo lectura del proyecto Neon SIDE-LITE `odd-dust-54712578` encontró `side-lite-dev` (br-snowy-moon-bcshnyw2) con tres funciones y trigger de un minuto desactivado. Auth requiere correo verificado y utiliza correo compartido. La protección local fija los hosts de desarrollo y deliberadamente no permite utilizar estos artefactos con una rama nueva hasta definir y probar una configuración específica; una rama copiada puede heredar usuarios, sesiones, funciones y variables que apuntan al padre. No activar ni invocar componentes heredados hasta verificar cada conexión.

Se prepararon `202611080001_profile_insert_privileges_dev.sql` y el cambio correspondiente de API, que deben aplicarse y desplegarse conjuntamente en un entorno aislado: la API crea perfiles como estudiantes y no puede insertar directamente el rol docente. Prueba de permisos en PostgreSQL 17 local efímero: aprobada para inserción, prohibición de teacher, autorización explícita, revocación, correo y rol. No se aplicó a Neon. Pasaron 35 pruebas unitarias y se compilaron BFF, API y cierre; las tres pruebas de navegador Neon aislado se enumeraron, pero no se ejecutaron.

Pendiente antes de una vista privada: elegir origen de rama y comprobar datos/Auth heredados; adaptar endpoints de la nueva rama con salvaguardas verificadas; integrar y probar registro, OTP real, sesiones y revocación con bandeja autorizada; configurar y probar el cierre programado, concurrencia y recuperación; probar los tres navegadores; auditar límites de abuso, secretos y dominios. No se ha hecho push ni se han modificado recursos remotos en esta etapa.

## Correcciones locales de seguridad y validación

Se separaron las concesiones previstas de API y cierre en `202611080002_separate_closer_privileges_dev.sql`; la API ya no recibe INSERT de resultados, UPDATE de caja/inventario/estado ni UPDATE de ID de perfiles. El puente exige identidades y conexiones distintas. Los permisos SQL de API siguen siendo amplios y NO garantizan aislamiento por usuario frente al compromiso de su credencial; ver `docs/separacion-roles-desarrollo.md`. No aplicar esta migración a Neon sin resolver los riesgos y revisar rol, membresías y conexión de cierre.

Los endpoints de inicio y detalle ya no devuelven la semilla; el motor sigue usándola internamente. Pasaron 38 pruebas unitarias y las tres compilaciones. En PostgreSQL 17 efímero pasaron pruebas de roles, cierre, autorización cruzada y semilla, partidas de 3 y 6 ciclos, ciclo de 120 s y reinicio de backend con base encendida. Playwright pasó dos casos gráficos: el primero cubrió docente, incorporación de dos estudiantes y decisiones gráficas de un estudiante; confirmaciones de ambos se probaron por API. Neon Auth y correo reales, permisos efectivos Neon, aislamiento SQL por identidad y recuperación tras caída de la base siguen pendientes. No se realizó push ni se modificó Neon.
