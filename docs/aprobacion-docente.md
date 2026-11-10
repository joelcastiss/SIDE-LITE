# Aprobación administrativa de docentes

El registro crea una identidad y un perfil básico sin conceder facultades docentes. El campo de confirmación de Auth no demuestra control del correo cuando la confirmación está desactivada. Antes de aprobar, la administración debe verificar fuera de banda la identidad, la titularidad de la cuenta y la condición docente; no basta con el dominio ni con `email_confirmed_at`. Verificar el UUID de Auth con el titular y rechazar coincidencias dudosas. No aprobar una cuenta reclamada por otra persona.

Un administrador con acceso de escritura a la base puede conceder o revocar en el SQL Editor de SIDE-LITE, después de verificar el UUID y correo en Auth. Sustituir ambos valores por los verificados; jamás obtenerlos de una solicitud anónima ni publicar credenciales. La concesión está ligada al UUID y al correo y solo el administrador puede escribirla.

```sql
insert into side_lite_private.lite_teacher_grants (user_id, approved_email)
select id, lower(email) from auth.users
where id = '00000000-0000-0000-0000-000000000000'::uuid
  and lower(email) = 'profesor@upch.pe'
  and is_anonymous is false
on conflict (user_id) do update
set approved_email = excluded.approved_email, granted_at = now(), revoked_at = null;
```

Confirmar que se afectó exactamente una fila. Para revocar, `update side_lite_private.lite_teacher_grants set revoked_at = now() where user_id = '<UUID verificado>'::uuid;`. La revocación se comprueba en el servidor al administrar partidas. El acceso administrativo a este procedimiento es privilegiado y se debe auditar de acuerdo con las normas de la institución.

La cuenta sin aprobación puede iniciar sesión y ve el estado pendiente. El correo y el curso del registro son datos declarados por el usuario, no pruebas de identidad. No se envía correo de confirmación en este procedimiento.
