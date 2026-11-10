# Revisión de Supabase SIDE-LITE — 9 de noviembre de 2026

Revisión de solo lectura del proyecto `hwwwoblfpsqqrkxvclag`. No se ejecutaron cambios remotos. La revisión no acredita que los controles no listados sean correctos.

## Bloqueos

1. **Crítico:** `public.lite_sessions`, `public.lite_auth_limits`, `public.lite_teacher_grades` y `public.lite_teacher_podium` tienen RLS desactivada. Las consultas de catálogo confirmaron que los roles `anon` y `authenticated` tienen permisos SELECT, INSERT, UPDATE y DELETE sobre las cuatro tablas. La lista de tablas devolvió cero filas para las cuatro; eso no elimina el riesgo de escritura o de futuras exposiciones. Revisar inmediatamente el acceso Data API y preparar una corrección con revocación de privilegios y RLS/políticas apropiadas. No aplicar a ciegas: activar RLS sin políticas puede bloquear flujos legítimos.
2. No se enumeraron Edge Functions en el proyecto; el adaptador de Lite apunta a `side-lite-api`. No se puede considerar operativo el backend remoto ni el cierre programado por las pruebas locales.
3. El historial de migraciones remoto enumera `202611030001_lite_local`, `202611030002_auth_limits_local`, `202611090001_local_cycle_control` y `202611090002_local_teacher_podium`. Estas migraciones corresponden al servidor local y no demuestran que el esquema de Supabase preparado en `supabase-side-lite/supabase/migrations` esté instalado. Es necesario conciliar el esquema real antes de preparar un despliegue.
4. El asesor reporta protección de contraseñas filtradas deshabilitada. Comprobar disponibilidad, política institucional y configuración antes del uso real.
5. MFA: el cliente ahora permite el reto TOTP y bloquea AAL1 cuando Supabase indica un factor pendiente. Esto no es una garantía de autorización de servidor: hay que verificar y reforzar el control de AAL y factores en la API y Data API antes de confiar en MFA. La prueba real local no pudo registrar TOTP porque ese stack lo tiene desactivado.
6. El ingreso de invitado aún no está implementado. Los usuarios anónimos de Supabase reciben el rol `authenticated`; las políticas existentes comprueban correo confirmado y requieren revisar identidad, membresía, antiabuso, recuperación, unicidad y aislamiento antes de admitirlos. El código y nombres públicos de una empresa no bastan para recuperar su identidad.

El asesor también marca dos tablas privadas con RLS habilitada y sin políticas. Esa combinación no implica por sí sola exposición: se deben revisar esquema expuesto, propietarios y permisos efectivos.

## Validación pendiente

Pruebas negativas de permisos directos y API, revocación, MFA real en servidor, inscripción y recuperación segura de invitados, dos estudiantes y docente, 3 y 6 ciclos, cierre con navegadores cerrados y recuperación del programador, podio, carga y políticas de retención. Ejecutar primero en un proyecto local o rama separada y verificada; no utilizar SIDE Original.
