-- Atualiza ensure_profile() para auto-criar profile no primeiro login.
-- Resultado:
-- - primeiro profile criado: owner + approved
-- - seguintes: hub_admin + pending
-- Evita redirecionar para /cadastro apenas porque ainda não existe linha em profiles.

create or replace function public.ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub uuid := auth.uid();
  v_email text;
  v_name text;
  v_id uuid;
  v_has_owner boolean;
  v_role text;
  v_status text;
begin
  if v_sub is null then
    raise exception 'not authenticated';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles missing';
  end if;

  select u.email, coalesce(u.raw_user_meta_data->>'full_name', '')
    into v_email, v_name
  from auth.users u
  where u.id = v_sub;

  select p.id into v_id from public.profiles p where p.auth_subject = v_sub;
  if v_id is not null then
    update public.profiles
    set
      email = case
        when v_email is not null and v_email <> '' then v_email
        else email
      end,
      full_name = case
        when coalesce(trim(v_name), '') <> '' and coalesce(trim(full_name), '') = '' then trim(v_name)
        else full_name
      end,
      updated_at = now()
    where auth_subject = v_sub;
    return v_id;
  end if;

  select exists (
    select 1 from public.profiles p where p.role = 'owner' and p.approval_status = 'approved'
  ) into v_has_owner;

  if not v_has_owner then
    v_role := 'owner';
    v_status := 'approved';
  else
    v_role := 'hub_admin';
    v_status := 'pending';
  end if;

  insert into public.profiles (
    auth_subject,
    email,
    full_name,
    role,
    approval_status
  )
  values (
    v_sub,
    coalesce(nullif(trim(v_email), ''), 'pending-email@example.com'),
    nullif(trim(v_name), ''),
    v_role,
    v_status
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.ensure_profile() to authenticated, service_role;

notify pgrst, 'reload schema';
