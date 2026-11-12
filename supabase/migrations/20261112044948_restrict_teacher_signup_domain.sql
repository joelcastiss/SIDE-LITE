-- Email identities in SIDE-LITE are teachers; anonymous student sessions remain allowed.
-- This checks address text only and does not establish ownership of the mailbox.
create or replace function side_lite_private.lite_restrict_teacher_email()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Existing accounts remain usable when an update leaves their identity intact.
  if tg_op = 'UPDATE' and new.email is not distinct from old.email
     and new.is_anonymous is not distinct from old.is_anonymous then
    return new;
  end if;
  if coalesce(new.is_anonymous, false) is false
     and lower(coalesce(new.email, '')) !~ '^[^@[:space:]]+@upch[.]pe$' then
    raise exception 'Se requiere correo institucional @upch.pe.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function side_lite_private.lite_restrict_teacher_email()
  from public, anon, authenticated, service_role;

create trigger lite_restrict_teacher_email
  before insert or update of email, is_anonymous on auth.users
  for each row execute function side_lite_private.lite_restrict_teacher_email();
