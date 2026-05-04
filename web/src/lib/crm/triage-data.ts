import type { SupabaseClient } from '@supabase/supabase-js'

export type TriageLeadRow = {
  id: string
  pipeline_id: string
  stage_id: string
  source: string
  display_name: string | null
  summary: string | null
  hub_classification: string | null
  created_at: string
  updated_at: string
}

export type PipelineStageRow = {
  id: string
  slug: string
  name: string
  position: number
}

export type TriageBoardData = {
  leads: TriageLeadRow[]
  stages: PipelineStageRow[]
}

/**
 * Leads do funil semeado `triagem-hub` + etapas (join em memória).
 */
export async function fetchTriageBoard(supabase: SupabaseClient): Promise<TriageBoardData> {
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select('id')
    .eq('slug', 'triagem-hub')
    .maybeSingle()

  if (pipelineError) throw pipelineError
  if (!pipeline) {
    return { leads: [], stages: [] }
  }

  const [leadsRes, stagesRes] = await Promise.all([
    supabase
      .from('triage_leads')
      .select(
        'id, pipeline_id, stage_id, source, display_name, summary, hub_classification, created_at, updated_at',
      )
      .eq('pipeline_id', pipeline.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('pipeline_stages')
      .select('id, slug, name, position')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true }),
  ])

  if (leadsRes.error) throw leadsRes.error
  if (stagesRes.error) throw stagesRes.error

  return {
    leads: (leadsRes.data ?? []) as TriageLeadRow[],
    stages: (stagesRes.data ?? []) as PipelineStageRow[],
  }
}
