-- BORRADOR PARA REVISIÓN. NO ES UNA MIGRACIÓN APLICABLE.
-- ALCANCE: perfiles propios y almacenamiento privado de autorizaciones docentes.
-- NO cubre partidas, decisiones, RLS del simulador, sesiones, cierre ni API.
-- Requiere proyecto Supabase nuevo e independiente y revisión de seguridad.
-- Se deja ROLLBACK al final: incluso su ejecución accidental no instala cambios.
-- No aplicar sobre la base local ni el proyecto de SIDE original.
-- La tabla local lite_profiles usa password_hash y no debe copiarse a Auth.
-- Supone que el registro anónimo de Supabase Auth está deshabilitado.

BEGIN;

-- Nombre nuevo para evitar colisionar con lite_profiles local.
CREATE TABLE public.side_lite_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.side_lite_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.side_lite_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.side_lite_profiles TO authenticated;
GRANT INSERT (id, display_name) ON public.side_lite_profiles TO authenticated;
-- Solo el nombre puede cambiarlo el usuario, no su ID ni la fecha de creación.
GRANT UPDATE (display_name) ON public.side_lite_profiles TO authenticated;

CREATE POLICY side_lite_profile_read_own ON public.side_lite_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
CREATE POLICY side_lite_profile_create_own ON public.side_lite_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY side_lite_profile_update_own ON public.side_lite_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Esquema no expuesto por Data API y sin acceso para clientes.
-- Un operador autorizado crea/revoca una fila a través de un procedimiento
-- administrativo que todavía no está implementado. El correo, por sí solo,
-- nunca otorga privilegios. No almacenar esta autorización en user_metadata.
CREATE SCHEMA side_lite_private;
REVOKE ALL ON SCHEMA side_lite_private FROM PUBLIC, anon, authenticated;
CREATE TABLE side_lite_private.teacher_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_email text NOT NULL CHECK (approved_email = lower(btrim(approved_email))),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (approved_email ~ '^[^@[:space:]]+@upch[.]pe$'),
  CHECK (revoked_at IS NULL OR revoked_at >= approved_at)
);
ALTER TABLE side_lite_private.teacher_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON side_lite_private.teacher_grants FROM PUBLIC, anon, authenticated;
-- Ninguna política para clientes: denegación por defecto incluso si un GRANT
-- se concede por error. No hay funciones SECURITY DEFINER ni API de promoción.

-- CONTRATO PENDIENTE DE IMPLEMENTACIÓN EN EL BACKEND AUTORIZADO:
-- 1. Verificar JWT y sesión. Consultar auth.users con privilegios mínimos y
--    comprobar email_confirmed_at no nulo y correo actual exactamente igual
--    (sin distinguir mayúsculas) a approved_email.
-- 2. Consultar teacher_grants con user_id del JWT y revoked_at IS NULL en cada
--    operación docente; no confiar en perfiles ni metadatos editables.
-- 3. Aprobar o revocar solo con un flujo administrativo independiente y
--    auditado; verificar cambios de correo y revocación de sesiones.
-- 4. Probar selección/modificación ajena, intentos de autoaprobación, correo
--    institucional sin autorización, cambio de correo, revocación y acceso
--    anónimo con roles y JWT reales en Supabase aislado. Ejecutar advisors.
-- 5. Revisar grants heredados, rol de backend, exposición Data API, bloqueo y
--    disponibilidad del esquema, migración de usuarios y política de borrado.
-- No existe todavía un backend capaz de hacer cumplir este contrato.

ROLLBACK;
