# Pruebas con Supabase CLI aislado

`scripts/test-supabase-auth-local.mjs` comprueba registro, denegación antes de
confirmar, correo recibido en Mailpit local, confirmación, inicio, renovación y
revocación del token de renovación. Comprueba que la expiración declarada esté
en el futuro; no espera una hora para comprobar que un token caduque.

`scripts/test-supabase-browser-local.mjs` usa Chromium con Auth, API y cierre
Edge reales de un stack local. Registra un docente y dos estudiantes mediante
la interfaz, confirma los correos del buzón local y concede al docente permiso
explícito en la base desechable. Recorre partidas de tres y seis ciclos y revisa
que cada ciclo produzca dos resultados con campos económicos. Con la opción
predeterminada cierra todas las páginas durante el primer ciclo de tres y
espera su vencimiento real de 120 segundos; el resto de vencimientos se adelanta
en la base aislada. Los resultados se validan por presencia y campos, no se
recalcula aquí cada resultado económico. No prueba entrega de correo ni el
programador alojados en Supabase.

Ambos scripts comprueban antes de escribir que existen los contenedores y
puertos del proyecto local exclusivo `side-lite-supabase-stack-verify`.
Requieren además una copia estática de prueba en `127.0.0.1:4178` que apunte a
la API local de Supabase `127.0.0.1:56521`; el frontend de producción conserva
su restricción al proyecto confirmado. El stack debe tener sus migraciones y
funciones de prueba, confirmación de correo activada, Mailpit en 56524 y un
barrido local activo. Nunca dirigir estas pruebas a proyectos remotos.

Con el stack local ya levantado, desde la raíz del repositorio en PowerShell:

```powershell
$env:SIDE_TEST_DISPOSABLE='YES'
$status=npx supabase status -o env --workdir "$env:TEMP/side-lite-supabase-stack-verify" 2>$null
$entry=$status | Where-Object { $_ -match '^ANON_KEY=' } | Select-Object -First 1
if (-not $entry) { throw 'No se obtuvo la clave anónima local' }
$env:SIDE_TEST_LOCAL_ANON_KEY=$entry.Substring(9).Trim('"')
node scripts/test-supabase-auth-local.mjs
node scripts/test-supabase-browser-local.mjs
$env:SIDE_TEST_MOBILE='YES'
$env:SIDE_TEST_ACCELERATED='YES'
node scripts/test-supabase-browser-local.mjs
```

En el último comando se aceleran todos los vencimientos, también el primero;
el recorrido móvil no acredita esperas reales de 120 segundos. Las cuentas y
partidas creadas permanecen en el stack desechable hasta retirarlo. No se
utilizan ni solicitan claves privadas de un proyecto alojado.
