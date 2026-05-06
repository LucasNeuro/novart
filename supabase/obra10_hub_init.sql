-- =============================================================================
-- Obra10+ HUB — init único (SQL Editor, role postgres, base vazia)
-- =============================================================================
-- ⚠ NÃO volte a executar este ficheiro inteiro se as tabelas já existem — obterá
--   erro "relation already exists" (ex.: pipelines). Para alterações pontuais numa
--   base já criada use os snippets em supabase/snippets/ (ex.:
--   alter_profiles_opencnpj_payload.sql).
-- =============================================================================
-- · public.profiles: identidade (auth_subject sem FK a auth.*), role, aprovação.
--   — Primeiro registo (finalize_registration): owner + approved.
--   — Seguintes com pedido HUB: hub_admin + pending até o owner aprovar.
-- · hub_admins removido; CRM: role ∈ (owner, hub_admin) e approval_status = approved.
-- · RPCs: ensure_profile, finalize_registration, approve_hub_candidate, is_hub_staff,
--   is_hub_admin (alias), is_owner.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid (),
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
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create unique index profiles_email_lower_idx on public.profiles (lower (trim (email)));

-- No máximo um owner aprovado (primeiro finalize ganha owner; novos ficam hub_admin pending).
create unique index profiles_single_approved_owner on public.profiles ((true))
  where role = 'owner' and approval_status = 'approved';

create unique index profiles_cpf_unique on public.profiles (cpf)
  where cpf is not null;

comment on table public.profiles is
  'Perfis da app; auth_subject = JWT. Primeiro owner aprova hub_admin pendentes.';

create table public.pipelines (
  id uuid primary key default gen_random_uuid (),
  slug text not null unique,
  name text not null,
  is_default_triage boolean not null default false,
  created_at timestamptz not null default now ()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid (),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  slug text not null,
  name text not null,
  position int not null,
  is_terminal boolean not null default false,
  unique (pipeline_id, slug),
  unique (pipeline_id, position)
);

create index pipeline_stages_pipeline_id_idx on public.pipeline_stages (pipeline_id);

create table public.triage_leads (
  id uuid primary key default gen_random_uuid (),
  pipeline_id uuid not null references public.pipelines (id),
  stage_id uuid not null references public.pipeline_stages (id),
  source text not null check (source in ('whatsapp', 'form', 'manual')),
  external_id text,
  display_name text,
  summary text,
  ai_suggested_kind text,
  ai_confidence numeric(4, 3),
  hub_classification text,
  organizacao_id uuid,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  unique (source, external_id)
);

create index triage_leads_stage_id_idx on public.triage_leads (stage_id);
create index triage_leads_pipeline_id_idx on public.triage_leads (pipeline_id);

create table public.domain_events (
  id uuid primary key default gen_random_uuid (),
  event_type text not null,
  aggregate_type text not null default 'triage_lead',
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now ()
);

create index domain_events_aggregate_idx on public.domain_events (aggregate_type, aggregate_id);
create index domain_events_created_at_idx on public.domain_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_owner ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_subject = auth.uid ()
      and p.role = 'owner'
      and p.approval_status = 'approved'
  );
$$;

create or replace function public.is_hub_staff ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_subject = auth.uid ()
      and p.role in ('owner', 'hub_admin')
      and p.approval_status = 'approved'
  );
$$;

-- Mantém o nome antigo para o cliente e políticas existentes
create or replace function public.is_hub_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_hub_staff ();
$$;

grant execute on function public.is_owner () to authenticated;
grant execute on function public.is_owner () to service_role;
grant execute on function public.is_hub_staff () to authenticated;
grant execute on function public.is_hub_staff () to service_role;
grant execute on function public.is_hub_admin () to authenticated;
grant execute on function public.is_hub_admin () to service_role;

-- ---------------------------------------------------------------------------
-- RPCs sessão / cadastro
-- ---------------------------------------------------------------------------
create or replace function public.ensure_profile ()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub uuid := auth.uid ();
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
      updated_at = now ()
    where auth_subject = v_sub;
    return v_id;
  end if;

  return null;
end;
$$;

grant execute on function public.ensure_profile () to authenticated;
grant execute on function public.ensure_profile () to service_role;

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

create or replace function public.approve_hub_candidate (p_profile_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner () then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set
    approval_status = case when p_approve then 'approved' else 'rejected' end,
    updated_at = now ()
  where id = p_profile_id
    and role = 'hub_admin'
    and approval_status = 'pending';
end;
$$;

grant execute on function public.approve_hub_candidate (uuid, boolean) to authenticated;
grant execute on function public.approve_hub_candidate (uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.triage_leads enable row level security;
alter table public.domain_events enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth_subject = auth.uid ());

create policy profiles_select_staff on public.profiles
  for select using (public.is_hub_staff ());

create policy profiles_update_own on public.profiles
  for update using (auth_subject = auth.uid ())
  with check (auth_subject = auth.uid ());

-- Sem INSERT directo: perfis criados via finalize_registration() (security definer).
-- Aprovação real é via RPC approve_hub_candidate

create policy pipelines_hub_all on public.pipelines
  for all using (public.is_hub_staff ()) with check (public.is_hub_staff ());

create policy pipeline_stages_hub_all on public.pipeline_stages
  for all using (public.is_hub_staff ()) with check (public.is_hub_staff ());

create policy triage_leads_hub_all on public.triage_leads
  for all using (public.is_hub_staff ()) with check (public.is_hub_staff ());

create policy domain_events_hub_all on public.domain_events
  for all using (public.is_hub_staff ()) with check (public.is_hub_staff ());

-- ---------------------------------------------------------------------------
-- Funil padrão
-- ---------------------------------------------------------------------------
insert into public.pipelines (slug, name, is_default_triage)
values ('triagem-hub', 'Triagem HUB', true);

insert into public.pipeline_stages (pipeline_id, slug, name, position, is_terminal)
select p.id, x.slug, x.name, x.position, x.is_terminal
from public.pipelines p
cross join (
  values
    ('novo'::text, 'Novo'::text, 0::int, false::boolean),
    ('classificacao-pendente', 'Classificação pendente', 1, false),
    ('classificado', 'Classificado', 2, false),
    ('arquivado', 'Arquivado', 3, true)
) as x (slug, name, position, is_terminal)
where p.slug = 'triagem-hub';

-- Sem seed de utilizador aqui: o primeiro registo em /cadastro define o owner.
-- Limpar contas de teste: supabase/remover_usuarios_por_email.sql
-- Owner manual (só dev): supabase/primeiro_owner.sql

notify pgrst, 'reload schema';
