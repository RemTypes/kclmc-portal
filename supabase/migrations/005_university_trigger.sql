-- ============================================================
-- KCLMC Platform — Migration 005: Update handle_new_user trigger
-- Reads student_id and university from user metadata on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, student_id, university)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')), ''),
    coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'university', '')), ''), 'King''s College London')
  )
  on conflict (id) do update set
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
    student_id = coalesce(excluded.student_id, public.profiles.student_id),
    university = coalesce(excluded.university, public.profiles.university);
  return new;
end;
$$;
