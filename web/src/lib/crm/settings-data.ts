import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type PersistenceMode = 'supabase' | 'local'

export type PipelineConfigRow = {
  id: string
  name: string
  slug: string
}

export type PipelineStageConfigRow = {
  id: string
  pipeline_id: string
  name: string
  slug: string
  position: number
}

export type PipelineSettingsSnapshot = {
  mode: PersistenceMode
  pipelines: PipelineConfigRow[]
  stages: PipelineStageConfigRow[]
  message: string | null
}

export type PersistResult =
  | { ok: true; mode: PersistenceMode; message: string | null }
  | { ok: false; error: string }

export type SavePipelineInput = {
  id?: string
  name: string
  slug: string
}

export type SaveStageInput = {
  id?: string
  pipeline_id: string
  name: string
  slug: string
  position: number
}

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const msg = error.message.toLowerCase()
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

const pendingMessage =
  'Persistência pendente: tabelas de configurações não disponíveis. Alterações ficarão apenas nesta sessão.'

export async function loadPipelineSettings(supabase: SupabaseClient): Promise<PipelineSettingsSnapshot> {
  const [pipelinesRes, stagesRes] = await Promise.all([
    supabase.from('pipelines').select('id, name, slug').order('name', { ascending: true }),
    supabase
      .from('pipeline_stages')
      .select('id, pipeline_id, name, slug, position')
      .order('pipeline_id', { ascending: true })
      .order('position', { ascending: true }),
  ])

  if (isMissingTableError(pipelinesRes.error) || isMissingTableError(stagesRes.error)) {
    return {
      mode: 'local',
      pipelines: [],
      stages: [],
      message: pendingMessage,
    }
  }

  if (pipelinesRes.error) throw pipelinesRes.error
  if (stagesRes.error) throw stagesRes.error

  return {
    mode: 'supabase',
    pipelines: (pipelinesRes.data ?? []) as PipelineConfigRow[],
    stages: (stagesRes.data ?? []) as PipelineStageConfigRow[],
    message: null,
  }
}

function fallbackResult(): PersistResult {
  return { ok: true, mode: 'local', message: pendingMessage }
}

export async function savePipelineRemote(
  supabase: SupabaseClient,
  input: SavePipelineInput,
): Promise<PersistResult> {
  if (input.id) {
    const { error } = await supabase
      .from('pipelines')
      .update({ name: input.name, slug: input.slug })
      .eq('id', input.id)
    if (isMissingTableError(error)) return fallbackResult()
    if (error) return { ok: false, error: error.message }
    return { ok: true, mode: 'supabase', message: null }
  }

  const { error } = await supabase.from('pipelines').insert({ name: input.name, slug: input.slug })
  if (isMissingTableError(error)) return fallbackResult()
  if (error) return { ok: false, error: error.message }
  return { ok: true, mode: 'supabase', message: null }
}

export async function deletePipelineRemote(
  supabase: SupabaseClient,
  pipelineId: string,
): Promise<PersistResult> {
  const { error } = await supabase.from('pipelines').delete().eq('id', pipelineId)
  if (isMissingTableError(error)) return fallbackResult()
  if (error) return { ok: false, error: error.message }
  return { ok: true, mode: 'supabase', message: null }
}

export async function saveStageRemote(
  supabase: SupabaseClient,
  input: SaveStageInput,
): Promise<PersistResult> {
  const payload = {
    pipeline_id: input.pipeline_id,
    name: input.name,
    slug: input.slug,
    position: input.position,
  }
  if (input.id) {
    const { error } = await supabase.from('pipeline_stages').update(payload).eq('id', input.id)
    if (isMissingTableError(error)) return fallbackResult()
    if (error) return { ok: false, error: error.message }
    return { ok: true, mode: 'supabase', message: null }
  }

  const { error } = await supabase.from('pipeline_stages').insert(payload)
  if (isMissingTableError(error)) return fallbackResult()
  if (error) return { ok: false, error: error.message }
  return { ok: true, mode: 'supabase', message: null }
}

export async function deleteStageRemote(supabase: SupabaseClient, stageId: string): Promise<PersistResult> {
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId)
  if (isMissingTableError(error)) return fallbackResult()
  if (error) return { ok: false, error: error.message }
  return { ok: true, mode: 'supabase', message: null }
}
