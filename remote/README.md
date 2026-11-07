# SIDE Lite — vista previa privada en Neon de desarrollo

Proyecto `odd-dust-54712578`, rama `side-lite-dev` (`br-snowy-moon-bcshnyw2`). No utilizar SIDE original ni Neon main. La URL privada es `https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech/`; exige la credencial de vista previa, deshabilita el registro público y no está habilitada para estudiantes reales. Las cuentas de prueba permanecen bloqueadas fuera de pruebas expresamente autorizadas.

## BFF y sesión

`sideweb` sirve el frontend y se comunica con Neon Auth y `sidepreview`. El navegador no recibe el JWT, `LITE_PREVIEW_KEY`, ni la conexión a PostgreSQL. La cookie de sesión propia contiene las cookies de Neon cifradas y autenticadas con AES-256-GCM; es `HttpOnly`, `Secure`, `SameSite=Strict` y restringida al origen. En cada solicitud de juego, el BFF consulta la sesión de Neon, exige correo verificado y obtiene allí un JWT para `sidepreview`; la API verifica además la identidad y autorización sobre la partida. Las escrituras comprueban origen y contenido JSON; el acceso de vista previa exige autenticación independiente, y el cuerpo se limita a 16 KiB.

La integración parte del ZIP de desarrollo entregado por el usuario. El empaquetador `scripts/build-bff.mjs` genera un artefacto temporal bajo `tests/output/bff/`. No se utilizó el desplegador del ZIP porque pasaba secretos como argumentos del proceso. Los secretos se guardan en variables del servicio y en `.neon-dev-secrets.json`, archivo local ignorado por Git. No imprimir ni publicar sus contenidos. El proxy usa directamente los endpoints HTTP de Neon con una envoltura de sesión propia; no es el SDK oficial y requiere revisión independiente antes de producción. Sus límites de intentos son por instancia, no un control distribuido de abuso.

## Pruebas

`npm test` incluye 28 pruebas locales, de las cuales cinco usan un proveedor controlado para comprobar el BFF. `e2e/bff-live.spec.js`, `e2e/bff-revocation-live.spec.js` y `e2e/bff-multiplayer-live.spec.js` usan el frontend HTTPS, BFF, Neon Auth y PostgreSQL reales; solo se ejecutan con `SIDE_LITE_BFF_LIVE=1`, credenciales de desarrollo ignoradas y cuentas habilitadas administrativamente. Esas identidades se verificaron administrativamente, no por recepción de correo, y se bloquearon al terminar.

Playwright comprobó sesiones independientes, recarga, cookies, rechazo anónimo y CSRF, revocación, cierre de sesión y rechazo de una cookie anterior, reconexión, ausencia de secretos en respuestas y acceso en móvil. Tres navegadores completaron una partida de tres ciclos y otra de seis ciclos de 30 segundos, y un ciclo de 120 segundos: los resultados visibles de docente y estudiantes coincidieron. La primera ejecución del test multijugador falló por un selector ambiguo y se corrigió antes de repetirla.

## Cierre y pendientes

`sideclose` cierra transaccionalmente, sin depender del navegador, y bloquea decisiones al vencimiento oficial. El trigger de prueba se activó durante los recorridos y se desactivó al terminarlos. No hay todavía un programador permanente recuperable compatible con la cuota gratuita: una invocación por minuto puede mantener activo el cómputo y, a 0,25 CU, consumir alrededor de 180 CU-horas en 30 días frente a las 100 CU-horas mensuales gratuitas documentadas. No activarlo permanentemente sin resolver el control de consumo.

Faltan comprobar la recepción real del OTP en una bandeja institucional autorizada, configurar SMTP y dominios de producción, revisar la integración HTTP y las cookies frente a los cambios de Neon, aplicar protección perimetral y límites distribuidos, y resolver el cierre automático recuperable. El registro público permanece desactivado y la vista previa no es una plataforma para estudiantes reales.
