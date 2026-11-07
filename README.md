> **Estado de la copia independiente:** antes de utilizar o publicar este proyecto, lee [ESTADO-Y-PUBLICACION.md](ESTADO-Y-PUBLICACION.md). El texto siguiente describe principalmente el entorno local y contiene secciones históricas; la integración Neon de desarrollo se documenta en `remote/README.md`.

# SIDE Lite — entorno multijugador local

SIDE Lite funciona localmente con Node.js y un PostgreSQL independiente en Docker. No utiliza el proyecto Supabase SIDE original. El servicio escucha únicamente en `127.0.0.1`: **es un entorno de desarrollo, no está listo para exponerse en Internet**.

## Inicio en Windows PowerShell

Desde `side-lite/`:

```powershell
docker compose up -d
npm ci
$env:DATABASE_URL='postgresql://lite:lite_local_only@127.0.0.1:57432/side_lite'
$env:TEACHER_REGISTRATION_KEY='cambiar-por-clave-local-larga'
npm run migrate
npm start
```

Abrir http://127.0.0.1:4178. La carpeta local ignorada `.data/` conserva los datos dentro de SIDE1. No usar las contraseñas de ejemplo fuera del entorno local. El servidor y el migrador solo admiten PostgreSQL local: rechazan también la referencia del Supabase original.

El docente crea una cuenta con la clave de registro configurada, inicia sesión y crea una partida. Comparte el código con los estudiantes, quienes crean su cuenta y se incorporan antes del primer ciclo. El docente inicia cada ciclo; al llegar el plazo, el servidor cierra automáticamente incluso si nadie tiene el navegador abierto. Si el servidor está apagado al vencimiento, al reiniciarlo procesa los ciclos vencidos. El siguiente ciclo lo inicia el docente. La última ronda cierra la partida y deja su historial accesible.

Los estudiantes pueden guardar borradores y confirmar. Una confirmación es definitiva. Si no hay decisión confirmada no se compra, gasta ni vende. El capital y la tienda se asignan una vez al incorporarse. La duración predeterminada es 120 segundos; se puede reducir para pruebas locales.

## Pruebas

```powershell
npm test
$env:PLAYWRIGHT_BROWSERS_PATH='<directorio-de-navegadores-dentro-de-SIDE1>'
npx playwright install chromium
npm run test:e2e
npm run test:abuse
node e2e/restart.js
```

Para Playwright el servidor debe estar en marcha en el puerto 4178. La prueba `restart.js` inicia y detiene su propio proceso en el puerto 4180 y requiere que no haya otros servidores SIDE Lite usando esa misma base si se desea verificar la recuperación del cierre después de una caída completa. Las pruebas escriben cuentas y partidas de prueba en la base local.

Las campañas de publicidad describen el monto elegido; son simuladas y no realizan publicaciones reales. El presupuesto exacto sigue determinando su efecto continuo. La aplicación avisa si se pierde la conexión: los cambios solo quedan persistidos al guardar o confirmar.

## Modelo económico

Compra al costo ajustado por evento, venta con inventario FIFO y marketing como gasto. Marketing admite S/ 0 o un monto entero de S/ 200 a S/ 10.000. Su factor de demanda es `1 + 0.3 * ln(1 + monto/1000) / ln(11)`, creciente con rendimientos decrecientes y máximo de 30 %. La semilla y el evento se guardan en cada ciclo. El ranking utiliza `(caja + valor FIFO del inventario - capital inicial) / capital inicial`, con desempate por caja y nombre.

El cierre bloquea cada ciclo y las empresas dentro de una transacción PostgreSQL; restricciones únicas impiden duplicar decisiones y resultados. Solo decisiones confirmadas se procesan. El servidor valida rango, caja, usuario, partida y plazo oficial.

## Pendiente antes de publicar para uso real

La migración `202611030001_lite_local.sql` es para el servidor local propio; **no debe aplicarse directamente a un Supabase expuesto**. Falta sustituir la autenticación local por Supabase Auth, agregar políticas RLS y permisos probados, endurecer sesiones, aplicar controles adicionales de abuso y configurar HTTPS, y crear un cierre programado alojado y una Edge Function autenticada. No hay infraestructura remota ni URL pública configurada. La interfaz estática de práctica anterior no es un sustituto de este servidor.
