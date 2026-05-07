import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { fetchTriageBoard } from './triage-data'

export type CrmDataSource = 'pipeline_geral' | 'triage_fallback'

export type CrmLead = {
  id: string
  display_name: string
  summary: string | null
  source: string
  classification: string | null
  segment: string | null
  stage_id: string
  stage_name: string
  stage_position: number | null
  created_at: string | null
  updated_at: string | null
}

export type CrmStage = {
  id: string
  name: string
  position: number
}

export type CrmBoardData = {
  source: CrmDataSource
  leads: CrmLead[]
  stages: CrmStage[]
}

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])

function isMissingRelationError(error: PostgrestError | null): boolean {
  if (!error) return false
  if (MISSING_TABLE_CODES.has(error.code ?? '')) return true
  const message = error.message.toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('relation') ||
    message.includes('schema cache')
  )
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function normalizePipelineGeralRow(record: Record<string, unknown>, index: number): CrmLead {
  const stageName = pickString(record, ['stage_name', 'stage', 'pipeline_stage_name']) ?? 'Sem etapa'
  const stageId =
    pickString(record, ['stage_id', 'pipeline_stage_id']) ??
    `pipeline-geral-stage-${stageName.toLowerCase().replace(/\s+/g, '-')}`

  return {
    id: pickString(record, ['id', 'lead_id']) ?? `pipeline-geral-lead-${index}`,
    display_name:
      pickString(record, ['display_name', 'name', 'lead_name', 'full_name', 'client_name']) ?? 'Sem nome',
    summary: pickString(record, ['summary', 'description', 'notes']),
    source: pickString(record, ['source', 'lead_source', 'channel']) ?? 'manual',
    classification: pickString(record, ['hub_classification', 'classification']),
    segment: pickString(record, ['segment', 'segmento', 'segment_slug', 'vertical']),
    stage_id: stageId,
    stage_name: stageName,
    stage_position: pickNumber(record, ['stage_position', 'position']),
    created_at: pickString(record, ['created_at']),
    updated_at: pickString(record, ['updated_at']),
  }
}

function stagesFromLeads(leads: CrmLead[]): CrmStage[] {
  const map = new Map<string, CrmStage>()
  for (const lead of leads) {
    const existing = map.get(lead.stage_id)
    const nextPosition = lead.stage_position ?? existing?.position ?? Number.MAX_SAFE_INTEGER
    map.set(lead.stage_id, {
      id: lead.stage_id,
      name: lead.stage_name,
      position: nextPosition,
    })
  }
  return [...map.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

async function tryFetchPipelineGeral(supabase: SupabaseClient): Promise<CrmBoardData | null> {
  const { data, error } = await supabase
    .from('pipeline_geral')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400)

  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }

  const leads = ((data ?? []) as Record<string, unknown>[]).map((row, index) =>
    normalizePipelineGeralRow(row, index),
  )

  return {
    source: 'pipeline_geral',
    leads,
    stages: stagesFromLeads(leads),
  }
}

async function fetchFromTriage(supabase: SupabaseClient): Promise<CrmBoardData> {
  const data = await fetchTriageBoard(supabase)
  const stageMap = new Map(data.stages.map((stage) => [stage.id, stage]))
  const leads: CrmLead[] = data.leads.map((lead) => {
    const stage = stageMap.get(lead.stage_id)
    return {
      id: lead.id,
      display_name: lead.display_name?.trim() || 'Sem nome',
      summary: lead.summary,
      source: lead.source,
      classification: lead.hub_classification,
      segment: lead.hub_classification,
      stage_id: lead.stage_id,
      stage_name: stage?.name ?? 'Sem etapa',
      stage_position: stage?.position ?? null,
      created_at: lead.created_at,
      updated_at: lead.updated_at,
    }
  })

  return {
    source: 'triage_fallback',
    leads,
    stages: data.stages.map((stage) => ({ id: stage.id, name: stage.name, position: stage.position })),
  }
}

/**
 * MVP: usa `pipeline_geral` quando disponível; fallback para triagem + etapas.
 */
export async function fetchCrmBoardData(supabase: SupabaseClient): Promise<CrmBoardData> {
  const primary = await tryFetchPipelineGeral(supabase)
  if (primary) return primary
  return fetchFromTriage(supabase)
}
