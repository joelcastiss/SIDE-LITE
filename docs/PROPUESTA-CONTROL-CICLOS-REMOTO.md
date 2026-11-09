# Propuesta pendiente: controles de ciclos en backend remoto

Estado: **diseño no implementado ni autorizado para Neon**. No hay migración remota lista ni controles remotos conectados. Los controles de `server/` y `supabase/migrations/202611090001_local_cycle_control.sql` son únicamente para desarrollo local.

## Garantías necesarias

- Mantener el ciclo en estado `open` durante una pausa y conservar el índice único existente. Añadir `paused_at` y `close_requested_at` con restricciones de coherencia; `ends_at` se desplaza por la duración efectiva de la pausa. Todas las operaciones usan el reloj de PostgreSQL y bloqueo de la fila del ciclo. Una pausa después del vencimiento no debe impedir el cierre.
- La decisión verifica, con el mismo bloqueo, que el ciclo no esté pausado, solicitado para cierre ni vencido. Inicio no permite un segundo ciclo mientras el primero esté abierto, también durante pausa.
- El proceso de cierre mantiene exclusivamente la escritura de resultados, saldos e inventarios y la transición a `closed`. Debe procesar los vencidos y los pedidos de cierre anticipado, ignorar pausados, bloquear y recalcular en la misma transacción e impedir duplicados mediante la restricción existente. No se ejecuta ningún cálculo en el servicio docente.
- Solicitudes persistentes sobreviven a reinicios. El barrido paginado debe incluir los pedidos anticipados, tratar fallos de forma aislada y seguir funcionando con varios trabajadores concurrentes.

## Identidad y privilegios

La API actual utiliza un rol PostgreSQL compartido y transmite identificadores de usuario a funciones de base de datos. Comprobar en una función `SECURITY DEFINER` que el UUID recibido corresponde a un docente autorizado y propietario de la partida **no demuestra que sea el sujeto autenticado**: quien disponga de la credencial compartida puede invocar la función con otro UUID. Tampoco basta con un `SET` de sesión accesible para el mismo rol.

No otorgar a `lite_dev_api` permisos directos de actualización del estado o reloj de los ciclos para resolver este problema. Una opción por evaluar es un servicio de control separado que verifique de forma independiente el token Neon Auth, valide vigencia, correo, autorización y propiedad, y use una credencial PostgreSQL propia de mínimo privilegio. Su interfaz debe autenticarse y no confiar en UUID o cabeceras suministradas por la API o el cliente. La identidad y la autorización deben revisarse también al procesar las solicitudes cuando corresponda. Analizar expresamente las condiciones de carrera con revocaciones. Si se usan funciones privilegiadas, fijar `search_path`, revocar `PUBLIC`, reducir propietario y permisos, y auditar que no haya membresías heredadas.

Una credencial de servicio comprometida seguiría pudiendo abusar de sus propios permisos; no se debe presentar la separación de roles como aislamiento por estudiante frente a ese compromiso. La solución final requiere definir el modelo de confianza y pruebas negativas de suplantación de identidad. La migración debe poder aplicarse de forma coordinada y transaccional y disponer de recuperación antes de solicitar autorización.

## Validación todavía requerida

1. Probar todas las migraciones remotas en PostgreSQL 17 aislado con roles API, controlador y cerrador reales, incluidos `PUBLIC`, membresías, propietarios y funciones `SECURITY DEFINER`.
2. Verificar que API no puede escribir relojes, estados, solicitudes, saldos ni resultados; que controlador no puede cerrar ni calcular resultados; y que cerrador no puede gestionar docentes o partidas.
3. Probar estudiante, docente ajeno, docente revocado, identidad suplantada, carrera pausa/vencimiento, decisión/pausa, revocación/control, dos cerradores y reinicio después de solicitud de cierre.
4. Solo tras esas comprobaciones preparar la integración remota y solicitar autorización para cualquier migración Neon o despliegue.

La prueba `e2e/cycle-controls.js` ejecutada contra PostgreSQL 17 local verificó autorización del servidor local, pausa durante reinicio, reanudación y cierre anticipado con tres cerradores concurrentes y un único resultado. **No valida** Neon Auth, los roles remotos ni la propuesta anterior.
