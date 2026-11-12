# Bolsos 3D y noticias del ciclo

Se integraron visores procedurales con Three.js local en Calidad, con pausa por visibilidad, desmontaje al salir, calidad reducida en equipos modestos, respaldo y créditos. El anuncio utiliza el evento persistido del ciclo y el sondeo existente; conserva la noticia en Resumen, respeta movimiento reducido y evita repeticiones por partida, ciclo e identificador.

Archivos principales: `public/js/bag-viewer.js`, `public/js/lite-bag-views.js`, `public/vendor/side-bags/`, `public/js/event-flash.js`, `public/css/event-flash.css`, `public/js/lite-decisions.js`, `public/js/lite-events.js`, `public/css/lite-decisions-content.css`, `public/index.html`, `public/services/credits_data.js`, `e2e/bag-views.spec.js` y `e2e/event-flash.spec.js`.

Capturas: [escritorio](capturas/decision-1366x768.png) y [móvil](capturas/decision-390x844.png).

Pruebas: `npm test` aprobó 114/114. Las tres pruebas del anuncio pasaron, incluidas cola, duración, duplicados, desplazamiento y reconexión simulada. Las pruebas adaptables de Decisiones pasaron en siete tamaños; las capturas provienen de dos de ellos. Las pruebas simuladas de 30 alternancias y respaldo WebGL pasaron. La batería E2E completa presenta fallos anteriores: varios casos intentan registrar docentes por el servidor local, que responde que el registro docente debe hacerse mediante Supabase. Algunas pruebas live requieren servicios y credenciales aisladas.

El servidor ya guarda `event_id` en el ciclo: no se necesita migración ni SQL de Supabase. El sondeo existente puede introducir hasta aproximadamente cinco segundos de diferencia entre estudiantes. Los identificadores desconocidos se presentan como «Noticia del mercado»; queda pendiente incorporar textos españoles al catálogo si aparecen eventos nuevos. Revisión independiente realizada; la publicación en main queda condicionada a que todas las pruebas pasen.

La prueba con WebGL real no es concluyente: una ejecución registró 90 montajes y 90 llamadas a dispose, pero no pudo confirmar la pérdida asíncrona de los contextos; una repetición agotó 180 segundos. La batería E2E completa se interrumpió después de varios fallos y una prueba detenida; no se ha demostrado que todos los casos existentes pasen. En ese momento aún no se había publicado.

## Revalidación de la rama

`npm test`: 114/114 aprobadas. `npx playwright test e2e/event-flash.spec.js --workers=1`: 3/3 aprobadas.

Comparación controlada con PostgreSQL 17 local efímero: `npx playwright test e2e/campaign.spec.js e2e/full-two-students-local.spec.js --workers=1 --timeout=20000 --reporter=line` produjo los mismos cuatro fallos en la rama (base `1ffa72ccf3a7e2684858094a6ea2fbb97a24cc93`) y en el worktree limpio de `origin/main` (`e74932898db9bbd9cda22392953d26a985686495`). En ambos, `POST /api/register` para docente devuelve 403: «Registra tu cuenta docente mediante Supabase». Los archivos de servidor y pruebas son idénticos entre esos commits.

La prueba siguiente a la última salida del recorrido anterior, y por ello candidata más probable a la detención, es `supabase-profile.spec.js:17`. Aislada con `--grep "primera sesión solicita perfil" --workers=1 --timeout=30000 --global-timeout=45000`, falla igual en ambos árboles al esperar `#student-auth-switch button` (línea 28). El registro anterior no identifica inequívocamente la prueba activa.

La corrección de WebGL invierte el orden de liberación: `forceContextLoss()` antes de `renderer.dispose()`, también ante fallos parciales. `npx playwright test e2e/bag-views.spec.js --workers=1 --timeout=120000`: 3/3 aprobadas (13,3 s). En 30 alternancias se crearon y perdieron 90 contextos reales, sin mensajes «Too many active WebGL contexts»; tras remontar, los tres lienzos tenían píxeles visibles. La prueba consulta WebGL 2 cuando corresponde.

Comparación adicional: `npx playwright test e2e/multiplayer.spec.js e2e/official-cycle.spec.js e2e/processing.spec.js --workers=1 --global-timeout=60000 --reporter=line` falló 4/4 tanto en `origin/main` como en la rama, todos por el mismo HTTP 403 al registrar docentes.

Vista previa: en escritorio y móvil, el caso student falla en ambos árboles al no encontrar el elemento esperado (`#student-entry` en móvil). Los casos teacher aislados, para ambas vistas y ambos árboles, terminaron con el mismo plazo de prueba de 60 s agotado. Se empleó límite global de 100 s por ejecución.

Sobre main actualizado (base 8b25a42), tras resolver el orden de scripts, npm test aprobó 116/116 y Playwright aprobó 15/15 para bolsos, anuncio y decisiones adaptables.
