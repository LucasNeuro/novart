-- Automação permanente: sincroniza auth.users -> public.profiles/public.users/public.hub_admins
-- Execute 1x no SQL Editor (role postgres). Depois disso, não precisa de query manual no dia a dia.
--
-- Pré-requisito:
-- 1) public.profiles + RPCs já existentes (bootstrap_profiles_auth_layer.sql)
-- 2) public.users e public.hub_admins existentes no schema novo

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles não existe. Execute antes: supabase/snippets/bootstrap_profiles_auth_layer.sql';
  end if;
  if to_regclass('public.users') is null then
    raise exception 'public.users não existe.';
  end if;
  if to_regclass('public.hub_admins') is null then
    raise exception 'public.hub_admins não existe.';
  end if;
end $$;

create unique index if not exists users_auth_subject_uq on public.users (auth_subject);

create or replace function public.sync_single_auth_user_to_app_tables(
  p_auth_id uuid,
  p_email text,
  p_full_name text,
  p_confirmed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_id uuid;
  v_user_id uuid;
  v_has_owner boolean;
  v_role text;
  v_status text;
begin
  -- Só sincroniza usuário confirmado.
  if p_confirmed_at is null then
    return;
  end if;

  p_email := coalesce(nullif(lower(trim(p_email)), ''), 'pending-email@example.com');
  p_full_name := nullif(trim(coalesce(p_full_name, '')), '');

  -- profiles (camada auth do app atual)
  select p.id into v_profile_id
  from public.profiles p
  where p.auth_subject = p_auth_id;

  if v_profile_id is null then
    select exists (
      select 1
      from public.profiles p
      where p.role = 'owner' and p.approval_status = 'approved'
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
      p_auth_id,
      p_email,
      p_full_name,
      v_role,
      v_status
    )
    returning id into v_profile_id;
  else
    update public.profiles
    set
      email = p_email,
      full_name = case
        when p_full_name is not null and coalesce(trim(full_name), '') = '' then p_full_name
        else full_name
      end,
      updated_at = now()
    where id = v_profile_id;
  end if;

  -- users (camada schema novo)
  insert into public.users (auth_subject, email, full_name, metadata)
  values (
    p_auth_id,
    p_email,
    p_full_name,
    jsonb_build_object('source', 'auth_trigger')
  )
  on conflict (auth_subject) do update
  set
    email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name),
    updated_at = now()
  returning id into v_user_id;

  if v_user_id is null then
    select u.id into v_user_id
    from public.users u
    where u.auth_subject = p_auth_id;
  end if;

  -- hub_admins (somente staff aprovado)
  if exists (
    select 1
    from public.profiles p
    where p.auth_subject = p_auth_id
      and p.role in ('owner', 'hub_admin')
      and p.approval_status = 'approved'
  ) then
    insert into public.hub_admins (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;
  else
    delete from public.hub_admins where user_id = v_user_id;
  end if;

  return;
end;
$$;

create or replace function public.sync_auth_user_to_app_tables()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.sync_single_auth_user_to_app_tables(
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.confirmed_at
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_auth_users_to_app on auth.users;
create trigger trg_sync_auth_users_to_app
after insert or update on auth.users
for each row
execute function public.sync_auth_user_to_app_tables();

-- Backfill inicial de confirmados já existentes no Auth.
do $$
declare
  r record;
begin
  for r in
    select
      u.id,
      u.email,
      u.confirmed_at,
      coalesce(u.raw_user_meta_data->>'full_name', '') as full_name
    from auth.users u
    where u.confirmed_at is not null
    order by u.created_at asc
  loop
    perform public.sync_single_auth_user_to_app_tables(
      r.id,
      r.email,
      r.full_name,
      r.confirmed_at
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
