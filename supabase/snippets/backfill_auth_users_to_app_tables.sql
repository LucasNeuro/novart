-- HOTFIX: backfill de auth.users para public.profiles/public.users/public.hub_admins
-- Uso: SQL Editor (role postgres) na base do deploy.
-- Objetivo: garantir que utilizadores já confirmados no Auth existam nas tabelas da app.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles não existe. Execute antes bootstrap_profiles_auth_layer.sql';
  end if;
  if to_regclass('public.users') is null then
    raise exception 'public.users não existe neste schema.';
  end if;
  if to_regclass('public.hub_admins') is null then
    raise exception 'public.hub_admins não existe neste schema.';
  end if;
end $$;

create unique index if not exists users_auth_subject_uq on public.users (auth_subject);

do $$
declare
  r record;
  v_has_owner boolean;
  v_role text;
  v_status text;
  v_user_id uuid;
begin
  -- Processa apenas utilizadores confirmados no Auth.
  for r in
    select
      au.id as auth_id,
      coalesce(au.email, '') as email,
      coalesce(au.raw_user_meta_data->>'full_name', '') as full_name
    from auth.users au
    where au.confirmed_at is not null
    order by au.created_at asc
  loop
    -- 1) profiles
    if not exists (select 1 from public.profiles p where p.auth_subject = r.auth_id) then
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
        r.auth_id,
        case when trim(r.email) = '' then 'pending-email@example.com' else lower(trim(r.email)) end,
        nullif(trim(r.full_name), ''),
        v_role,
        v_status
      );
    else
      update public.profiles
      set
        email = case when trim(r.email) <> '' then lower(trim(r.email)) else email end,
        full_name = case
          when trim(r.full_name) <> '' and coalesce(trim(full_name), '') = '' then trim(r.full_name)
          else full_name
        end,
        updated_at = now()
      where auth_subject = r.auth_id;
    end if;

    -- 2) users (schema novo)
    insert into public.users (auth_subject, email, full_name, metadata)
    values (
      r.auth_id,
      case when trim(r.email) = '' then 'pending-email@example.com' else lower(trim(r.email)) end,
      nullif(trim(r.full_name), ''),
      jsonb_build_object('source', 'auth_backfill')
    )
    on conflict (auth_subject) do update
    set
      email = excluded.email,
      full_name = coalesce(public.users.full_name, excluded.full_name),
      updated_at = now()
    returning id into v_user_id;

    if v_user_id is null then
      select u.id into v_user_id from public.users u where u.auth_subject = r.auth_id;
    end if;

    -- 3) hub_admins (somente staff aprovado)
    if exists (
      select 1
      from public.profiles p
      where p.auth_subject = r.auth_id
        and p.role in ('owner', 'hub_admin')
        and p.approval_status = 'approved'
    ) then
      insert into public.hub_admins (user_id)
      values (v_user_id)
      on conflict (user_id) do nothing;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
