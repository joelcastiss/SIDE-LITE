# Registro docente con Supabase

La migración `supabase-side-lite/supabase/migrations/20261110193520_automatic_institutional_teacher.sql` prepara la asignación docente a cuentas `@upch.pe`. No recrea tablas ni altera partidas. Los permisos revocados previamente permanecen revocados. El disparador existente crea el perfil y guarda el curso. La migración fue probada en un entorno aislado y aplicada al proyecto de producción.

En el panel del proyecto Supabase, en **Authentication → Sign In / Providers → Email**, habilita el registro por correo y desactiva **Confirm email**. En **Authentication → Attack Protection → CAPTCHA**, desactiva CAPTCHA si está habilitado. El propietario confirmó que estos ajustes están configurados en el proyecto remoto. Con la confirmación desactivada, Supabase confirma automáticamente la identidad para permitir el acceso; no demuestra que la dirección exista o pertenezca al profesor. Cualquier persona puede registrarse usando un correo ficticio `@upch.pe`.

El cliente usa Supabase Auth y la API SIDE-LITE comprueba la identidad y la propiedad de las partidas. No se deben usar estas cuentas como prueba de identidad institucional. Las cuentas revocadas antes de la migración conservan su revocación.
