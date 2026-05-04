-- Obra10+ HUB — núcleo CRM triagem (MVP)
-- Aplicar no projeto Supabase (SQL editor ou supabase db push).

-- ---------------------------------------------------------------------------
-- Administrador HUB
-- ---------------------------------------------------------------------------
create table if not exists public.hub_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.hub_admins is 'Utilizadores com papel Administrador HUB (governação global).';

-- ---------------------------------------------------------------------------
-- Pipelines e etapas
-- ---------------------------------------------------------------------------
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid (),
  slug text not null unique,
  name text not null,
  is_default_triage boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid (),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  slug text not null,
  name text not null,
  position int not null,
  is_terminal boolean not null default false,
  unique (pipeline_id, slug),
  unique (pipeline_id, position)
);

create index if not exists pipeline_stages_pipeline_id_idx on public.pipeline_stages (pipeline_id);

-- ---------------------------------------------------------------------------
-- Leads de triagem
-- ---------------------------------------------------------------------------
create table if not exists public.triage_leads (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists triage_leads_stage_id_idx on public.triage_leads (stage_id);
create index if not exists triage_leads_pipeline_id_idx on public.triage_leads (pipeline_id);

-- ---------------------------------------------------------------------------
-- Eventos de domínio (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid (),
  event_type text not null,
  aggregate_type text not null default 'triage_lead',
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists domain_events_aggregate_idx on public.domain_events (aggregate_type, aggregate_id);
create index if not exists domain_events_created_at_idx on public.domain_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Função auxiliar RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_hub_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_admins h
    where h.user_id = auth.uid ()
  );
$$;

comment on function public.is_hub_admin is 'true se auth.uid() for administrador HUB.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hub_admins enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.triage_leads enable row level security;
alter table public.domain_events enable row level security;

drop policy if exists hub_admins_self_read on public.hub_admins;
create policy hub_admins_self_read on public.hub_admins
  for select using (auth.uid () = user_id);

drop policy if exists pipelines_hub_all on public.pipelines;
create policy pipelines_hub_all on public.pipelines
  for all using (public.is_hub_admin ()) with check (public.is_hub_admin ());

drop policy if exists pipeline_stages_hub_all on public.pipeline_stages;
create policy pipeline_stages_hub_all on public.pipeline_stages
  for all using (public.is_hub_admin ()) with check (public.is_hub_admin ());

drop policy if exists triage_leads_hub_all on public.triage_leads;
create policy triage_leads_hub_all on public.triage_leads
  for all using (public.is_hub_admin ()) with check (public.is_hub_admin ());

drop policy if exists domain_events_hub_all on public.domain_events;
create policy domain_events_hub_all on public.domain_events
  for all using (public.is_hub_admin ()) with check (public.is_hub_admin ());

-- ---------------------------------------------------------------------------
-- Seed: pipeline e etapas padrão
-- ---------------------------------------------------------------------------
insert into public.pipelines (slug, name, is_default_triage)
values ('triagem-hub', 'Triagem HUB', true)
on conflict (slug) do nothing;

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
where p.slug = 'triagem-hub'
on conflict (pipeline_id, slug) do nothing;
