-- Dashboard views para o portal operacional (3 painéis).
-- Seguro para reexecução.

create or replace view public.vw_dashboard_portal_resumo as
with base as (
  select
    pg.id,
    pg.status,
    pg.potencial,
    pg.stage_id,
    pg.created_at,
    pg.updated_at
  from public.pipeline_geral pg
)
select
  count(*)::bigint as total_leads,
  count(*) filter (
    where lower(coalesce(base.potencial, '')) like '%alto%'
  )::bigint as high_potential_leads,
  (
    select count(*)::bigint
    from public.pipeline_stages ps
  ) as active_stages,
  count(*) filter (
    where (base.updated_at at time zone 'utc')::date = (now() at time zone 'utc')::date
  )::bigint as updated_today,
  count(*) filter (
    where lower(coalesce(base.status, '')) in ('fechado', 'won', 'ganho', 'concluido', 'concluído')
  )::bigint as closed_leads,
  round(
    (
      count(*) filter (
        where lower(coalesce(base.status, '')) in ('fechado', 'won', 'ganho', 'concluido', 'concluído')
      )::numeric
      / nullif(count(*)::numeric, 0)
    ) * 100,
    2
  ) as close_rate_percent
from base;

create or replace view public.vw_dashboard_portal_segmentos as
select
  pg.segmento,
  count(*)::bigint as total,
  round(avg(extract(epoch from (now() - pg.created_at)) / 86400.0)::numeric, 2) as avg_days_since_created,
  round(avg(extract(epoch from (now() - pg.updated_at)) / 86400.0)::numeric, 2) as avg_days_since_update
from public.pipeline_geral pg
group by pg.segmento
order by total desc;

create or replace view public.vw_dashboard_portal_ai_operacao as
select
  (select count(*)::bigint from public.maria_sessions) as total_sessions,
  (select count(*)::bigint from public.maria_messages) as total_messages,
  (select count(*)::bigint from public.maria_imoveis) as total_imoveis,
  (select count(*)::bigint from public.domain_events) as total_domain_events,
  (select max(ms.updated_at) from public.maria_sessions ms) as last_session_at,
  (select max(mm.created_at) from public.maria_messages mm) as last_message_at,
  (select max(mi.updated_at) from public.maria_imoveis mi) as last_imovel_update_at,
  (select max(de.created_at) from public.domain_events de) as last_domain_event_at;

-- Permissões de leitura (ajuste conforme seu modelo de RLS/perfis).
grant select on public.vw_dashboard_portal_resumo to anon, authenticated;
grant select on public.vw_dashboard_portal_segmentos to anon, authenticated;
grant select on public.vw_dashboard_portal_ai_operacao to anon, authenticated;
