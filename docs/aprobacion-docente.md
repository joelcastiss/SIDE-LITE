# Acceso docente automático

Por decisión del usuario, SIDE-LITE concede acceso docente al registrar una cuenta no anónima cuyo correo termina exactamente en `@upch.pe`. La migración `20261110055130_upch_teacher_access.sql` también aplica la regla a las cuentas existentes, sin reactivar autorizaciones revocadas. El permiso sigue vinculado al UUID y al correo de Auth, y una sesión revocada o una cuenta bloqueada no puede operar.

La confirmación por correo está desactivada. Por tanto, el dominio escrito no demuestra que la persona controle el buzón ni que sea docente de la universidad: cualquiera puede registrar una dirección disponible y acceder como docente. Solo un mecanismo independiente de identidad, como el inicio institucional, puede comprobar su titularidad.

Para revocar acceso, un administrador de la base puede ejecutar `update side_lite_private.lite_teacher_grants set revoked_at = now() where user_id = '<UUID verificado>'::uuid;`. Esta operación no elimina la cuenta ni sus partidas.
