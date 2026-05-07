import type { SupabaseClient } from '@supabase/supabase-js'

export type PipelineLead = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  resumo: string | null
  potencial: string | null
  status: string
  segmento: string
  stageId: string | null
  createdAt: string
  updatedAt: string
}

export type KanbanColumn = {
  id: string
  title: string
  slug: string
  stageId: string | null
  order: number
}

export type PortalBoardData = {
  leads: PipelineLead[]
  columns: KanbanColumn[]
  stats: {
    totalLeads: number
    highPotentialLeads: number
    activeStages: number
    updatedToday: number
    segmentCounts: Array<{ segmento: string; total: number }>
  }
  tableCounts: Array<{ label: string; total: number | null }>
  advanced: {
    closedLeads: number
    closeRatePercent: number | null
    lastSessionAt: string | null
    lastMessageAt: string | null
    lastImovelUpdateAt: string | null
    lastDomainEventAt: string | null
    segmentTempo: Array<{
      segmento: string
      avgDaysSinceCreated: number | null
      avgDaysSinceUpdate: number | null
    }>
  }
}

const FALLBACK_COLUMNS: KanbanColumn[] = [
  { id: 'status:novo', title: 'Novo', slug: 'novo', stageId: null, order: 0 },
  { id: 'status:contato', title: 'Contato', slug: 'contato', stageId: null, order: 1 },
  { id: 'status:qualificacao', title: 'Qualificação', slug: 'qualificacao', stageId: null, order: 2 },
  { id: 'status:proposta', title: 'Proposta', slug: 'proposta', stageId: null, order: 3 },
  { id: 'status:fechado', title: 'Fechado', slug: 'fechado', stageId: null, order: 4 },
]

function asLeadName(raw: string | null, index: number): string {
  const name = (raw ?? '').trim()
  if (name) return name
  return `Lead ${index + 1}`
}

function normalizeColumnsFromStages(
  stages: Array<{ id: string; name: string; slug: string; position: number }>,
): KanbanColumn[] {
  if (stages.length === 0) return FALLBACK_COLUMNS
  return stages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stage, index) => ({
      id: stage.id,
      title: stage.name,
      slug: stage.slug || stage.name.toLowerCase().replace(/\s+/g, '-'),
      stageId: stage.id,
      order: index,
    }))
}

async function fetchTableCount(supabase: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return null
  return count ?? 0
}

async function fetchViewSingle<T>(
  supabase: SupabaseClient,
  viewName: string,
): Promise<T | null> {
  const { data, error } = await supabase.from(viewName).select('*').maybeSingle()
  if (error) return null
  return (data as T | null) ?? null
}

async function fetchViewRows<T>(
  supabase: SupabaseClient,
  viewName: string,
): Promise<T[] | null> {
  const { data, error } = await supabase.from(viewName).select('*')
  if (error) return null
  return (data as T[] | null) ?? null
}

export async function loadPortalBoardData(supabase: SupabaseClient): Promise<PortalBoardData> {
  const [{ data: stageRows, error: stageError }, { data: leadRows, error: leadError }] =
    await Promise.all([
      supabase.from('pipeline_stages').select('id, name, slug, position, pipeline_id').order('position'),
      supabase
        .from('pipeline_geral')
        .select(
          'id, nome, email, telefone, resumo, potencial, status, segmento, stage_id, created_at, updated_at',
        )
        .order('updated_at', { ascending: false }),
    ])

  if (stageError) {
    throw new Error(stageError.message)
  }
  if (leadError) {
    throw new Error(leadError.message)
  }

  const stages =
    stageRows?.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      position: row.position,
    })) ?? []

  const columns = normalizeColumnsFromStages(stages)
  const columnByStage = new Map(columns.filter((col) => col.stageId).map((col) => [col.stageId as string, col]))
  const columnBySlug = new Map(columns.map((col) => [col.slug.toLowerCase(), col]))

  const leads: PipelineLead[] =
    leadRows?.map((row, index) => {
      const stageMatch = row.stage_id ? columnByStage.get(row.stage_id) : undefined
      const statusSlug = (row.status ?? '').toLowerCase().trim()
      const statusMatch = columnBySlug.get(statusSlug)
      const picked = stageMatch ?? statusMatch ?? FALLBACK_COLUMNS[0]
      return {
        id: row.id,
        nome: asLeadName(row.nome, index),
        email: row.email,
        telefone: row.telefone,
        resumo: row.resumo,
        potencial: row.potencial,
        status: picked.slug,
        segmento: row.segmento ?? 'geral',
        stageId: picked.stageId,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    }) ?? []

  const todayIso = new Date().toISOString().slice(0, 10)
  const segmentMap = new Map<string, number>()
  for (const lead of leads) {
    segmentMap.set(lead.segmento, (segmentMap.get(lead.segmento) ?? 0) + 1)
  }

  const [summaryView, segmentView, aiOpsView, sessionsCount, messagesCount, imoveisCount, eventosCount] =
    await Promise.all([
      fetchViewSingle<{
        total_leads: number
        high_potential_leads: number
        active_stages: number
        updated_today: number
        closed_leads: number
        close_rate_percent: number | null
      }>(supabase, 'vw_dashboard_portal_resumo'),
      fetchViewRows<{
        segmento: string
        total: number
        avg_days_since_created: number | null
        avg_days_since_update: number | null
      }>(supabase, 'vw_dashboard_portal_segmentos'),
      fetchViewSingle<{
        total_sessions: number
        total_messages: number
        total_imoveis: number
        total_domain_events: number
        last_session_at: string | null
        last_message_at: string | null
        last_imovel_update_at: string | null
        last_domain_event_at: string | null
      }>(supabase, 'vw_dashboard_portal_ai_operacao'),
      fetchTableCount(supabase, 'maria_sessions'),
      fetchTableCount(supabase, 'maria_messages'),
      fetchTableCount(supabase, 'maria_imoveis'),
      fetchTableCount(supabase, 'domain_events'),
    ])

  const computedSegmentCounts = [...segmentMap.entries()]
    .map(([segmento, total]) => ({ segmento, total }))
    .sort((a, b) => b.total - a.total)

  const segmentCountsFromView =
    segmentView
      ?.map((row) => ({ segmento: row.segmento, total: Number(row.total) }))
      .sort((a, b) => b.total - a.total) ?? null

  const segmentTempoFromView =
    segmentView?.map((row) => ({
      segmento: row.segmento,
      avgDaysSinceCreated:
        row.avg_days_since_created === null ? null : Number(row.avg_days_since_created),
      avgDaysSinceUpdate:
        row.avg_days_since_update === null ? null : Number(row.avg_days_since_update),
    })) ?? []

  const stats = {
    totalLeads: summaryView?.total_leads ?? leads.length,
    highPotentialLeads:
      summaryView?.high_potential_leads ??
      leads.filter((lead) => (lead.potencial ?? '').toLowerCase().includes('alto')).length,
    activeStages: summaryView?.active_stages ?? columns.length,
    updatedToday: summaryView?.updated_today ?? leads.filter((lead) => lead.updatedAt.slice(0, 10) === todayIso).length,
    segmentCounts: segmentCountsFromView ?? computedSegmentCounts,
  }

  const tableCounts = [
    { label: 'Sessões IA', total: aiOpsView?.total_sessions ?? sessionsCount },
    { label: 'Mensagens IA', total: aiOpsView?.total_messages ?? messagesCount },
    { label: 'Imóveis IA', total: aiOpsView?.total_imoveis ?? imoveisCount },
    { label: 'Eventos de domínio', total: aiOpsView?.total_domain_events ?? eventosCount },
  ]

  return {
    leads,
    columns,
    stats,
    tableCounts,
    advanced: {
      closedLeads: summaryView?.closed_leads ?? 0,
      closeRatePercent: summaryView?.close_rate_percent ?? null,
      lastSessionAt: aiOpsView?.last_session_at ?? null,
      lastMessageAt: aiOpsView?.last_message_at ?? null,
      lastImovelUpdateAt: aiOpsView?.last_imovel_update_at ?? null,
      lastDomainEventAt: aiOpsView?.last_domain_event_at ?? null,
      segmentTempo: segmentTempoFromView,
    },
  }
}

export async function movePipelineLead(
  supabase: SupabaseClient,
  leadId: string,
  target: KanbanColumn,
): Promise<void> {
  const payload = {
    stage_id: target.stageId,
    status: target.slug,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('pipeline_geral').update(payload).eq('id', leadId)
  if (error) throw new Error(error.message)
}
