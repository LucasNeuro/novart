-- Compatibilidade para ambiente que veio com schema novo (users/hub_admins)
-- mas app ainda usa public.profiles + RPCs auth (ensure_profile/finalize_registration).
-- Pode ser executado em base já existente (idempotente).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_subject uuid unique not null,
  email text not null,
  full_name text,
  cpf text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  role text not null default 'hub_admin'
    check (role in ('owner', 'hub_admin', 'client')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  opencnpj_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(trim(email)));
create unique index if not exists profiles_single_approved_owner on public.profiles ((true))
  where role = 'owner' and approval_status = 'approved';
create unique index if not exists profiles_cpf_unique on public.profiles (cpf)
  where cpf is not null;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_subject = auth.uid()
      and p.role = 'owner'
      and p.approval_status = 'approved'
  );
$$;

create or replace function public.is_hub_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_subject = auth.uid()
      and p.role in ('owner', 'hub_admin')
      and p.approval_status = 'approved'
  );
$$;

create or replace function public.is_hub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_hub_staff();
$$;

grant execute on function public.is_owner() to authenticated, service_role;
grant execute on function public.is_hub_staff() to authenticated, service_role;
grant execute on function public.is_hub_admin() to authenticated, service_role;

create or replace function public.ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub uuid := auth.uid();
  v_email text;
  v_id uuid;
begin
  if v_sub is null then
    raise exception 'not authenticated';
  end if;

  select u.email into v_email from auth.users u where u.id = v_sub;

  select p.id into v_id from public.profiles p where p.auth_subject = v_sub;
  if v_id is not null then
    update public.profiles
    set
      email = case
        when v_email is not null and v_email <> '' then v_email
        else email
      end,
      updated_at = now()
    where auth_subject = v_sub;
    return v_id;
  end if;

  return null;
end;
$$;

grant execute on function public.ensure_profile() to authenticated, service_role;

drop function if exists public.finalize_registration(text);

create or replace function public.finalize_registration(
  p_full_name text,
  p_cpf text default null,
  p_phone text default null,
  p_address jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_has_owner boolean;
  r_role text;
  r_status text;
  v_cpf text;
  v_phone text;
begin
  if v_sub is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(u.email, '') into v_email from auth.users u where u.id = v_sub;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'full_name too short';
  end if;

  v_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if length(v_cpf) <> 11 then
    raise exception 'cpf_invalid';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 11 then
    raise exception 'phone_invalid';
  end if;

  if coalesce(trim(p_address->>'street'), '') = ''
     or coalesce(trim(p_address->>'number'), '') = ''
     or coalesce(trim(p_address->>'district'), '') = ''
     or coalesce(trim(p_address->>'city'), '') = ''
     or coalesce(trim(p_address->>'state'), '') = ''
     or length(trim(p_address->>'state')) <> 2
     or coalesce(trim(p_address->>'postal_code'), '') = ''
     or length(regexp_replace(coalesce(p_address->>'postal_code', ''), '\D', '', 'g')) <> 8
  then
    raise exception 'address_incomplete';
  end if;

  if exists (select 1 from public.profiles p where p.auth_subject = v_sub) then
    select p.id into v_id from public.profiles p where p.auth_subject = v_sub;
    update public.profiles
    set
      full_name = trim(p_full_name),
      cpf = v_cpf,
      phone = v_phone,
      address = coalesce(p_address, '{}'::jsonb),
      email = case when v_email <> '' then v_email else email end,
      updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  select exists (
    select 1 from public.profiles p where p.role = 'owner' and p.approval_status = 'approved'
  ) into v_has_owner;

  if not v_has_owner then
    r_role := 'owner';
    r_status := 'approved';
  else
    r_role := 'hub_admin';
    r_status := 'pending';
  end if;

  insert into public.profiles (
    auth_subject,
    email,
    full_name,
    cpf,
    phone,
    address,
    role,
    approval_status
  )
  values (
    v_sub,
    nullif(trim(v_email), ''),
    trim(p_full_name),
    v_cpf,
    v_phone,
    coalesce(p_address, '{}'::jsonb),
    r_role,
    r_status
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.finalize_registration(text, text, text, jsonb) to authenticated, service_role;

create or replace function public.approve_hub_candidate(p_profile_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set
    approval_status = case when p_approve then 'approved' else 'rejected' end,
    updated_at = now()
  where id = p_profile_id
    and role = 'hub_admin'
    and approval_status = 'pending';
end;
$$;

grant execute on function public.approve_hub_candidate(uuid, boolean) to authenticated, service_role;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select using (auth_subject = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_staff'
  ) then
    create policy profiles_select_staff on public.profiles
      for select using (public.is_hub_staff());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update using (auth_subject = auth.uid())
      with check (auth_subject = auth.uid());
  end if;
end $$;

notify pgrst, 'reload schema';
