alter table public.lite_profiles add column course text;

-- Registration metadata is user-supplied; course is informational only.
create or replace function side_lite_private.create_student_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare profile_name text; profile_course text;
begin
  profile_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(profile_name) < 2 or char_length(profile_name) > 80 then
    profile_name := 'Estudiante';
  end if;
  profile_course := btrim(coalesce(new.raw_user_meta_data ->> 'curso', ''));
  if char_length(profile_course) < 1 or char_length(profile_course) > 100 then
    profile_course := null;
  end if;
  insert into public.lite_profiles (id, display_name, course) values (new.id, profile_name, profile_course)
  on conflict (id) do nothing;
  return new;
end $$;

update public.lite_profiles p set course = btrim(u.raw_user_meta_data ->> 'curso')
from auth.users u where u.id = p.id and p.course is null
  and char_length(btrim(coalesce(u.raw_user_meta_data ->> 'curso', ''))) between 1 and 100;
