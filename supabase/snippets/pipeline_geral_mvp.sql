-- MVP CRM: pipeline_geral unificado
-- Idempotente: pode ser executado mais de uma vez no SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.pipeline_geral (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id uuid not null,
  segmento text not null default 'geral'
    check (segmento in ('imoveis', 'arquitetura', 'produtos', 'servicos', 'geral')),
  nome text,
  telefone text,
  email text,
  resumo text,
  potencial text,
  potencial_justificativa text,
  pipeline_id uuid references public.pipelines (id) on delete set null,
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  status text not null default 'novo',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists pipeline_geral_segmento_idx
  on public.pipeline_geral (segmento);

create index if not exists pipeline_geral_stage_id_idx
  on public.pipeline_geral (stage_id);

create index if not exists pipeline_geral_updated_at_desc_idx
  on public.pipeline_geral (updated_at desc);

create index if not exists pipeline_geral_status_idx
  on public.pipeline_geral (status);

create or replace function public.pipeline_geral_is_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result boolean := false;
begin
  if to_regprocedure('public.is_hub_staff()') is not null then
    execute 'select public.is_hub_staff()' into v_result;
    return coalesce(v_result, false);
  end if;

  if to_regprocedure('public.is_hub_admin()') is not null then
    execute 'select public.is_hub_admin()' into v_result;
    return coalesce(v_result, false);
  end if;

  return false;
end;
$$;

grant execute on function public.pipeline_geral_is_staff() to authenticated, service_role;

create or replace function public.sync_maria_leads_to_pipeline_geral_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_segmento text;
  v_pipeline_id uuid;
  v_stage_id uuid;
begin
  v_segmento := lower(
    coalesce(
      nullif(v_row->>'segmento', ''),
      nullif(v_row->>'segment', ''),
      nullif(v_row->>'kind', ''),
      nullif(v_row->>'lead_kind', ''),
      'geral'
    )
  );

  if v_segmento not in ('imoveis', 'arquitetura', 'produtos', 'servicos', 'geral') then
    v_segmento := 'geral';
  end if;

  v_pipeline_id := case
    when coalesce(v_row->>'pipeline_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row->>'pipeline_id')::uuid
    else null
  end;

  v_stage_id := case
    when coalesce(v_row->>'stage_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_row->>'stage_id')::uuid
    else null
  end;

  insert into public.pipeline_geral (
    source,
    source_id,
    segmento,
    nome,
    telefone,
    email,
    resumo,
    potencial,
    potencial_justificativa,
    pipeline_id,
    stage_id,
    status,
    payload,
    created_at,
    updated_at
  )
  values (
    coalesce(nullif(v_row->>'source', ''), 'maria'),
    new.id,
    v_segmento,
    coalesce(
      nullif(v_row->>'nome', ''),
      nullif(v_row->>'name', ''),
      nullif(v_row->>'full_name', ''),
      nullif(v_row->>'display_name', '')
    ),
    coalesce(
      nullif(v_row->>'telefone', ''),
      nullif(v_row->>'phone', ''),
      nullif(v_row->>'whatsapp', ''),
      nullif(v_row->>'mobile', '')
    ),
    nullif(v_row->>'email', ''),
    coalesce(
      nullif(v_row->>'resumo', ''),
      nullif(v_row->>'summary', ''),
      nullif(v_row->>'descricao', ''),
      nullif(v_row->>'message', '')
    ),
    coalesce(
      nullif(v_row->>'potencial', ''),
      nullif(v_row->>'potential', ''),
      nullif(v_row->>'score', '')
    ),
    coalesce(
      nullif(v_row->>'potencial_justificativa', ''),
      nullif(v_row->>'potential_reason', ''),
      nullif(v_row->>'justificativa', '')
    ),
    v_pipeline_id,
    v_stage_id,
    coalesce(nullif(v_row->>'status', ''), 'novo'),
    coalesce(v_row, '{}'::jsonb),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (source, source_id) do update
  set
    segmento = excluded.segmento,
    nome = excluded.nome,
    telefone = excluded.telefone,
    email = excluded.email,
    resumo = excluded.resumo,
    potencial = excluded.potencial,
    potencial_justificativa = excluded.potencial_justificativa,
    pipeline_id = excluded.pipeline_id,
    stage_id = excluded.stage_id,
    status = excluded.status,
    payload = excluded.payload,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_triage_leads_to_pipeline_geral_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segmento text;
begin
  v_segmento := lower(
    coalesce(
      nullif(new.ai_suggested_kind, ''),
      nullif(new.hub_classification, ''),
      'geral'
    )
  );

  if v_segmento not in ('imoveis', 'arquitetura', 'produtos', 'servicos', 'geral') then
    v_segmento := 'geral';
  end if;

  insert into public.pipeline_geral (
    source,
    source_id,
    segmento,
    nome,
    telefone,
    email,
    resumo,
    potencial,
    potencial_justificativa,
    pipeline_id,
    stage_id,
    status,
    payload,
    created_at,
    updated_at
  )
  values (
    coalesce(nullif(new.source, ''), 'triage'),
    new.id,
    v_segmento,
    new.display_name,
    null,
    null,
    new.summary,
    case when new.ai_confidence is not null then trim(to_char(new.ai_confidence, 'FM0.000')) else null end,
    coalesce(nullif(new.hub_classification, ''), nullif(new.ai_suggested_kind, '')),
    new.pipeline_id,
    new.stage_id,
    'novo',
    jsonb_build_object(
      'table', 'triage_leads',
      'external_id', new.external_id,
      'hub_classification', new.hub_classification,
      'ai_suggested_kind', new.ai_suggested_kind,
      'ai_confidence', new.ai_confidence,
      'organizacao_id', new.organizacao_id
    ),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (source, source_id) do update
  set
    segmento = excluded.segmento,
    nome = excluded.nome,
    resumo = excluded.resumo,
    potencial = excluded.potencial,
    potencial_justificativa = excluded.potencial_justificativa,
    pipeline_id = excluded.pipeline_id,
    stage_id = excluded.stage_id,
    status = excluded.status,
    payload = excluded.payload,
    updated_at = now();

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.maria_leads') is not null then
    execute 'drop trigger if exists trg_sync_maria_leads_to_pipeline_geral on public.maria_leads';
    execute '
      create trigger trg_sync_maria_leads_to_pipeline_geral
      after insert or update on public.maria_leads
      for each row execute function public.sync_maria_leads_to_pipeline_geral_trg()
    ';
  else
    raise notice 'public.maria_leads não existe; trigger de sync não foi criado.';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.triage_leads') is not null then
    execute 'drop trigger if exists trg_sync_triage_leads_to_pipeline_geral on public.triage_leads';
    execute '
      create trigger trg_sync_triage_leads_to_pipeline_geral
      after insert or update on public.triage_leads
      for each row execute function public.sync_triage_leads_to_pipeline_geral_trg()
    ';
  else
    raise notice 'public.triage_leads não existe; trigger de sync não foi criado.';
  end if;
end;
$$;

alter table public.pipeline_geral enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pipeline_geral'
      and policyname = 'pipeline_geral_select_staff'
  ) then
    create policy pipeline_geral_select_staff
      on public.pipeline_geral
      for select
      using (public.pipeline_geral_is_staff());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pipeline_geral'
      and policyname = 'pipeline_geral_write_staff'
  ) then
    create policy pipeline_geral_write_staff
      on public.pipeline_geral
      for all
      using (public.pipeline_geral_is_staff())
      with check (public.pipeline_geral_is_staff());
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.maria_leads') is not null then
    insert into public.pipeline_geral (
      source,
      source_id,
      segmento,
      nome,
      telefone,
      email,
      resumo,
      potencial,
      potencial_justificativa,
      pipeline_id,
      stage_id,
      status,
      payload,
      created_at,
      updated_at
    )
    select
      coalesce(nullif(mj->>'source', ''), 'maria') as source,
      m.id as source_id,
      case
        when lower(
          coalesce(
            nullif(mj->>'segmento', ''),
            nullif(mj->>'segment', ''),
            nullif(mj->>'kind', ''),
            nullif(mj->>'lead_kind', ''),
            'geral'
          )
        ) in ('imoveis', 'arquitetura', 'produtos', 'servicos', 'geral')
          then lower(
            coalesce(
              nullif(mj->>'segmento', ''),
              nullif(mj->>'segment', ''),
              nullif(mj->>'kind', ''),
              nullif(mj->>'lead_kind', ''),
              'geral'
            )
          )
        else 'geral'
      end as segmento,
      coalesce(
        nullif(mj->>'nome', ''),
        nullif(mj->>'name', ''),
        nullif(mj->>'full_name', ''),
        nullif(mj->>'display_name', '')
      ) as nome,
      coalesce(
        nullif(mj->>'telefone', ''),
        nullif(mj->>'phone', ''),
        nullif(mj->>'whatsapp', ''),
        nullif(mj->>'mobile', '')
      ) as telefone,
      nullif(mj->>'email', '') as email,
      coalesce(
        nullif(mj->>'resumo', ''),
        nullif(mj->>'summary', ''),
        nullif(mj->>'descricao', ''),
        nullif(mj->>'message', '')
      ) as resumo,
      coalesce(
        nullif(mj->>'potencial', ''),
        nullif(mj->>'potential', ''),
        nullif(mj->>'score', '')
      ) as potencial,
      coalesce(
        nullif(mj->>'potencial_justificativa', ''),
        nullif(mj->>'potential_reason', ''),
        nullif(mj->>'justificativa', '')
      ) as potencial_justificativa,
      case
        when coalesce(mj->>'pipeline_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (mj->>'pipeline_id')::uuid
        else null
      end as pipeline_id,
      case
        when coalesce(mj->>'stage_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (mj->>'stage_id')::uuid
        else null
      end as stage_id,
      coalesce(nullif(mj->>'status', ''), 'novo') as status,
      coalesce(mj, '{}'::jsonb) as payload,
      coalesce(m.created_at, now()) as created_at,
      now() as updated_at
    from public.maria_leads m
    cross join lateral (select to_jsonb(m) as mj) r
    on conflict (source, source_id) do update
    set
      segmento = excluded.segmento,
      nome = excluded.nome,
      telefone = excluded.telefone,
      email = excluded.email,
      resumo = excluded.resumo,
      potencial = excluded.potencial,
      potencial_justificativa = excluded.potencial_justificativa,
      pipeline_id = excluded.pipeline_id,
      stage_id = excluded.stage_id,
      status = excluded.status,
      payload = excluded.payload,
      updated_at = now();
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.triage_leads') is not null then
    insert into public.pipeline_geral (
      source,
      source_id,
      segmento,
      nome,
      resumo,
      potencial,
      potencial_justificativa,
      pipeline_id,
      stage_id,
      status,
      payload,
      created_at,
      updated_at
    )
    select
      coalesce(nullif(t.source, ''), 'triage') as source,
      t.id as source_id,
      case
        when lower(coalesce(nullif(t.ai_suggested_kind, ''), nullif(t.hub_classification, ''), 'geral'))
             in ('imoveis', 'arquitetura', 'produtos', 'servicos', 'geral')
          then lower(coalesce(nullif(t.ai_suggested_kind, ''), nullif(t.hub_classification, ''), 'geral'))
        else 'geral'
      end as segmento,
      t.display_name as nome,
      t.summary as resumo,
      case when t.ai_confidence is not null then trim(to_char(t.ai_confidence, 'FM0.000')) else null end as potencial,
      coalesce(nullif(t.hub_classification, ''), nullif(t.ai_suggested_kind, '')) as potencial_justificativa,
      t.pipeline_id,
      t.stage_id,
      'novo' as status,
      jsonb_build_object(
        'table', 'triage_leads',
        'external_id', t.external_id,
        'hub_classification', t.hub_classification,
        'ai_suggested_kind', t.ai_suggested_kind,
        'ai_confidence', t.ai_confidence,
        'organizacao_id', t.organizacao_id
      ) as payload,
      coalesce(t.created_at, now()) as created_at,
      now() as updated_at
    from public.triage_leads t
    on conflict (source, source_id) do update
    set
      segmento = excluded.segmento,
      nome = excluded.nome,
      resumo = excluded.resumo,
      potencial = excluded.potencial,
      potencial_justificativa = excluded.potencial_justificativa,
      pipeline_id = excluded.pipeline_id,
      stage_id = excluded.stage_id,
      status = excluded.status,
      payload = excluded.payload,
      updated_at = now();
  end if;
end;
$$;

notify pgrst, 'reload schema';
