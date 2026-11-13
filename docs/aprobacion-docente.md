# Autorización docente

**Política vigente para pruebas:** la migración `20261113035244_automatic_teacher_test_access` sustituye el requisito de atribución independiente por una concesión automática para nuevos registros `@upch.pe`. Con la confirmación de correo desactivada, cualquiera puede escribir una dirección ajena y obtener acceso docente: este mecanismo no comprueba la titularidad del buzón y solo es apropiado para el entorno de pruebas autorizado. No modifica las concesiones existentes ni reactiva las revocadas. El procedimiento siguiente describe la política anterior y no se aplica tras esa migración.

El registro de una cuenta no concede permisos docentes. Un administrador debe verificar la identidad y aprobar expresamente el acceso. La autorización se vincula al UUID de Auth y al correo confirmado; una cuenta anónima, bloqueada, sin correo confirmado o con una autorización revocada no obtiene permisos docentes. Un correo institucional por sí solo no acredita la condición de docente.

La migración `20261113025642_independent_teacher_authorization` conserva las autorizaciones activas anteriores y registra las que no tienen aprobador en `side_lite_private.teacher_grants_pending_review`. Al aplicarla se verificaron nueve autorizaciones activas y nueve pendientes de revisión. La institución debe revisar su origen por un canal independiente; el registro pendiente no equivale a una aprobación y no revoca el acceso automáticamente.

Tras la verificación institucional, un operador autorizado de la base registra el UUID de la persona docente, su correo y el UUID de un administrador distinto en `side_lite_private.lite_teacher_grants`. El administrador debe existir en Auth; su UUID identifica al aprobador, pero por sí solo no demuestra su autoridad institucional. La nueva restricción rechaza concesiones activas sin atribución y la autoaprobación. La aplicación y sus roles de ejecución no pueden conceder ni revocar este permiso.

Procedimiento para una aprobación nueva:

1. La institución verifica por un canal independiente la identidad de la persona docente, su control del buzón y la autoridad del administrador. Conserva la decisión administrativa y su referencia en su sistema institucional. No considerar `email_confirmed_at` como prueba suficiente si en algún momento estuvo activada la confirmación automática.
2. Un operador con acceso administrativo a la base comprueba el UUID y el correo de ambas personas en Auth, comprueba que el docente no sea anónimo ni esté bloqueado y que su correo esté confirmado, y comprueba que no existe una autorización previa para el docente. No se aprueba por el dominio del correo.
3. Usando parámetros vinculados (no concatenación), ejecuta la siguiente consulta con `$1` = UUID docente y `$2` = UUID del administrador que autorizó. Debe devolver exactamente una fila; cero filas significa detenerse e investigar. No se ejecuta desde el navegador ni con la credencial de la API.

```sql
insert into side_lite_private.lite_teacher_grants(user_id, approved_email, granted_by)
select teacher.id, lower(btrim(teacher.email)), administrator.id
from auth.users teacher
join auth.users administrator on administrator.id = $2::uuid
where teacher.id = $1::uuid and teacher.id <> administrator.id
  and teacher.is_anonymous is false and teacher.email_confirmed_at is not null
  and (teacher.banned_until is null or teacher.banned_until <= clock_timestamp())
  and administrator.is_anonymous is false and administrator.email_confirmed_at is not null
  and (administrator.banned_until is null or administrator.banned_until <= clock_timestamp())
returning user_id, approved_email, granted_by, granted_at;
```

4. El operador verifica la fila y conserva en el expediente institucional la referencia de la decisión y el resultado. Una autorización revocada no se reactiva mediante este procedimiento: exige una nueva decisión y un procedimiento administrativo explícito. Para revocar, registra primero la decisión institucional y actualiza `revoked_at` para ese UUID. La tabla conserva el aprobador original y el momento de revocación, pero no registra por sí sola quién revocó; ese dato debe conservarse en el expediente institucional.

La restricción se aplicó y verificó en el proyecto SIDE-LITE mediante la migración `20261113025642_independent_teacher_authorization`. Cada nueva concesión requiere una decisión administrativa independiente.

La prueba integral real del registro, inicio de sesión y autorización independiente con una cuenta institucional controlada sigue pendiente. Las pruebas de navegador de este cambio usan respuestas simuladas y no acreditan el funcionamiento del correo o de una cuenta real.

En una instalación nueva deben aplicarse todas las migraciones en orden. La migración histórica `20261110193520_automatic_institutional_teacher` reintrodujo el acceso automático; la migración `20261113025642` lo desactiva. No debe detenerse la instalación antes de aplicar esta última.
