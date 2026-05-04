-- Migração incremental: projecto que já correu obra10_hub_init.sql antigo (sem CPF / morada).
-- SQL Editor, role postgres.

alter table public.profiles
  add column if not exists cpf text,
  add column if not exists phone text,
  add column if not exists address jsonb not null default '{}'::jsonb;

create unique index if not exists profiles_single_approved_owner on public.profiles ((true))
  where role = 'owner' and approval_status = 'approved';

create unique index if not exists profiles_cpf_unique on public.profiles (cpf)
  where cpf is not null;

drop function if exists public.finalize_registration (text);

create or replace function public.finalize_registration (
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
  v_sub uuid := auth.uid ();
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
      updated_at = now ()
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

grant execute on function public.finalize_registration (text, text, text, jsonb) to authenticated;
grant execute on function public.finalize_registration (text, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
