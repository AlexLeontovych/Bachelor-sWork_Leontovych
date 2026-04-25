create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_full_name text;
begin
  resolved_full_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'fullName',
        new.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    team_role,
    banned
  )
  values (
    new.id,
    lower(new.email),
    resolved_full_name,
    'user',
    'developer',
    false
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name),
    updated_at = now();

  return new;
end;
$$;

update public.profiles as profile
set
  full_name = nullif(
    trim(
      coalesce(
        auth_user.raw_user_meta_data ->> 'full_name',
        auth_user.raw_user_meta_data ->> 'fullName',
        auth_user.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  ),
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and nullif(trim(coalesce(profile.full_name, '')), '') is null
  and nullif(
    trim(
      coalesce(
        auth_user.raw_user_meta_data ->> 'full_name',
        auth_user.raw_user_meta_data ->> 'fullName',
        auth_user.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  ) is not null;
