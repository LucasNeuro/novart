import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../../lib/env'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  deletePipelineRemote,
  deleteStageRemote,
  loadPipelineSettings,
  savePipelineRemote,
  saveStageRemote,
  type PersistenceMode,
  type PipelineConfigRow,
  type PipelineStageConfigRow,
} from '../../lib/crm/settings-data'

export const Route = createFileRoute('/crm/configuracoes')({
  component: CrmConfiguracoesPage,
})

type DrawerState =
  | { kind: 'pipeline'; mode: 'create' | 'edit'; id?: string }
  | { kind: 'stage'; mode: 'create' | 'edit'; id?: string }
  | { kind: 'form'; mode: 'create' | 'edit'; id?: string }

type PipelineDraft = {
  id?: string
  name: string
  slug: string
}

type StageDraft = {
  id?: string
  pipeline_id: string
  name: string
  slug: string
  position: number
}

type FormFieldType = 'text' | 'email' | 'phone' | 'textarea'

type FormFieldDraft = {
  id: string
  label: string
  type: FormFieldType
  required: boolean
}

type FormTemplateDraft = {
  id?: string
  name: string
  slug: string
  description: string
  fields: FormFieldDraft[]
}

type FormTemplate = {
  id: string
  name: string
  slug: string
  description: string
  fields: FormFieldDraft[]
}

const fieldTypeOptions: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'textarea', label: 'Texto longo' },
]

const supabaseUnavailableMessage =
  'Persistência pendente: Supabase não configurado neste ambiente. Alterações ficam apenas em memória.'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pipelineTemplate(): PipelineDraft {
  return { name: '', slug: '' }
}

function stageTemplate(pipelineId = ''): StageDraft {
  return { pipeline_id: pipelineId, name: '', slug: '', position: 1 }
}

function formTemplate(): FormTemplateDraft {
  return {
    name: '',
    slug: '',
    description: '',
    fields: [{ id: createLocalId('field'), label: 'Nome', type: 'text', required: true }],
  }
}

function CrmConfiguracoesPage() {
  const queryClient = useQueryClient()
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>(
    isSupabaseConfigured() ? 'supabase' : 'local',
  )
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(
    isSupabaseConfigured() ? null : supabaseUnavailableMessage,
  )
  const [localPipelines, setLocalPipelines] = useState<PipelineConfigRow[]>([])
  const [localStages, setLocalStages] = useState<PipelineStageConfigRow[]>([])
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [pipelineDraft, setPipelineDraft] = useState<PipelineDraft>(pipelineTemplate())
  const [stageDraft, setStageDraft] = useState<StageDraft>(stageTemplate())
  const [formDraft, setFormDraft] = useState<FormTemplateDraft>(formTemplate())
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [stagePipelineFilter, setStagePipelineFilter] = useState<string>('all')
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['crm', 'configuracoes', 'pipelines'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return {
          mode: 'local' as const,
          pipelines: [],
          stages: [],
          message: supabaseUnavailableMessage,
        }
      }
      return loadPipelineSettings(getSupabaseBrowserClient())
    },
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    setPersistenceMode(settingsQuery.data.mode)
    setPersistenceMessage(settingsQuery.data.message)
  }, [settingsQuery.data])

  const remotePipelines = settingsQuery.data?.pipelines ?? []
  const remoteStages = settingsQuery.data?.stages ?? []
  const pipelines = persistenceMode === 'supabase' ? remotePipelines : localPipelines
  const stages = persistenceMode === 'supabase' ? remoteStages : localStages

  const pipelineNameById = useMemo(
    () => new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name])),
    [pipelines],
  )
  const stageRows = useMemo(() => {
    if (stagePipelineFilter === 'all') return stages
    return stages.filter((stage) => stage.pipeline_id === stagePipelineFilter)
  }, [stagePipelineFilter, stages])

  function bootstrapLocalFromCurrent() {
    setLocalPipelines((prev) => (prev.length === 0 ? remotePipelines : prev))
    setLocalStages((prev) => (prev.length === 0 ? remoteStages : prev))
  }

  function switchToLocalMode(message: string | null) {
    bootstrapLocalFromCurrent()
    setPersistenceMode('local')
    setPersistenceMessage(message ?? supabaseUnavailableMessage)
  }

  function openPipelineCreate() {
    setActionError(null)
    setNotice(null)
    setPipelineDraft(pipelineTemplate())
    setDrawer({ kind: 'pipeline', mode: 'create' })
  }

  function openPipelineEdit(pipeline: PipelineConfigRow) {
    setActionError(null)
    setNotice(null)
    setPipelineDraft({
      id: pipeline.id,
      name: pipeline.name,
      slug: pipeline.slug,
    })
    setDrawer({ kind: 'pipeline', mode: 'edit', id: pipeline.id })
  }

  function openStageCreate() {
    setActionError(null)
    setNotice(null)
    const defaultPipelineId =
      stagePipelineFilter !== 'all' ? stagePipelineFilter : (pipelines[0]?.id ?? '')
    const nextPosition =
      stages
        .filter((stage) => stage.pipeline_id === defaultPipelineId)
        .reduce((max, stage) => Math.max(max, stage.position), 0) + 1
    setStageDraft(stageTemplate(defaultPipelineId))
    setStageDraft((prev) => ({ ...prev, position: Math.max(1, nextPosition) }))
    setDrawer({ kind: 'stage', mode: 'create' })
  }

  function openStageEdit(stage: PipelineStageConfigRow) {
    setActionError(null)
    setNotice(null)
    setStageDraft({
      id: stage.id,
      pipeline_id: stage.pipeline_id,
      name: stage.name,
      slug: stage.slug,
      position: stage.position,
    })
    setDrawer({ kind: 'stage', mode: 'edit', id: stage.id })
  }

  function openFormCreate() {
    setActionError(null)
    setNotice(null)
    setFormDraft(formTemplate())
    setDrawer({ kind: 'form', mode: 'create' })
  }

  function openFormEdit(form: FormTemplate) {
    setActionError(null)
    setNotice(null)
    setFormDraft({
      id: form.id,
      name: form.name,
      slug: form.slug,
      description: form.description,
      fields: form.fields.map((field) => ({ ...field })),
    })
    setDrawer({ kind: 'form', mode: 'edit', id: form.id })
  }

  async function savePipeline() {
    const name = pipelineDraft.name.trim()
    const slug = slugify(pipelineDraft.slug || name)
    if (!name) {
      setActionError('Preencha o nome do funil.')
      return
    }
    if (!slug) {
      setActionError('Não foi possível gerar slug. Ajuste o nome do funil.')
      return
    }

    setBusyAction('pipeline-save')
    setActionError(null)
    if (persistenceMode === 'supabase' && isSupabaseConfigured()) {
      const result = await savePipelineRemote(getSupabaseBrowserClient(), {
        id: pipelineDraft.id,
        name,
        slug,
      })
      if (!result.ok) {
        setBusyAction(null)
        setActionError(result.error)
        return
      }
      if (result.mode === 'local') {
        switchToLocalMode(result.message)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['crm', 'configuracoes', 'pipelines'] })
        setNotice('Funil salvo no Supabase.')
      }
    }

    if (persistenceMode === 'local' || !isSupabaseConfigured()) {
      const id = pipelineDraft.id ?? createLocalId('pipeline')
      setLocalPipelines((prev) => {
        const next = [...prev]
        const idx = next.findIndex((row) => row.id === id)
        const item = { id, name, slug }
        if (idx === -1) next.unshift(item)
        else next[idx] = item
        return next
      })
      setNotice('Funil salvo em memória (persistência pendente).')
    }

    setBusyAction(null)
    setDrawer(null)
  }

  async function saveStage() {
    const name = stageDraft.name.trim()
    const slug = slugify(stageDraft.slug || name)
    if (!stageDraft.pipeline_id) {
      setActionError('Selecione um funil para a etapa.')
      return
    }
    if (!name) {
      setActionError('Preencha o nome da etapa.')
      return
    }
    if (!slug) {
      setActionError('Não foi possível gerar slug. Ajuste o nome da etapa.')
      return
    }

    setBusyAction('stage-save')
    setActionError(null)
    if (persistenceMode === 'supabase' && isSupabaseConfigured()) {
      const result = await saveStageRemote(getSupabaseBrowserClient(), {
        id: stageDraft.id,
        pipeline_id: stageDraft.pipeline_id,
        name,
        slug,
        position: Math.max(1, Math.trunc(stageDraft.position)),
      })
      if (!result.ok) {
        setBusyAction(null)
        setActionError(result.error)
        return
      }
      if (result.mode === 'local') {
        switchToLocalMode(result.message)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['crm', 'configuracoes', 'pipelines'] })
        setNotice('Etapa salva no Supabase.')
      }
    }

    if (persistenceMode === 'local' || !isSupabaseConfigured()) {
      const id = stageDraft.id ?? createLocalId('stage')
      setLocalStages((prev) => {
        const next = [...prev]
        const idx = next.findIndex((row) => row.id === id)
        const item = {
          id,
          pipeline_id: stageDraft.pipeline_id,
          name,
          slug,
          position: Math.max(1, Math.trunc(stageDraft.position)),
        }
        if (idx === -1) next.push(item)
        else next[idx] = item
        return next.sort((a, b) => a.position - b.position)
      })
      setNotice('Etapa salva em memória (persistência pendente).')
    }

    setBusyAction(null)
    setDrawer(null)
  }

  function saveFormTemplate() {
    const name = formDraft.name.trim()
    const slug = slugify(formDraft.slug || name)
    if (!name) {
      setActionError('Preencha o nome do modelo de formulário.')
      return
    }
    if (!slug) {
      setActionError('Não foi possível gerar slug. Ajuste o nome do modelo.')
      return
    }
    if (formDraft.fields.length === 0) {
      setActionError('Adicione pelo menos um campo.')
      return
    }
    if (formDraft.fields.some((field) => !field.label.trim())) {
      setActionError('Todos os campos precisam de rótulo.')
      return
    }

    const id = formDraft.id ?? createLocalId('form')
    const payload: FormTemplate = {
      id,
      name,
      slug,
      description: formDraft.description.trim(),
      fields: formDraft.fields.map((field) => ({
        ...field,
        label: field.label.trim(),
      })),
    }

    setForms((prev) => {
      const idx = prev.findIndex((item) => item.id === id)
      if (idx === -1) return [payload, ...prev]
      const next = [...prev]
      next[idx] = payload
      return next
    })
    setActionError(null)
    setNotice('Modelo salvo em memória (persistência pendente).')
    setDrawer(null)
  }

  async function removePipeline(pipelineId: string) {
    const confirmed = window.confirm('Excluir este funil? Etapas relacionadas serão removidas.')
    if (!confirmed) return
    setActionError(null)
    setNotice(null)
    setBusyAction(`pipeline-delete-${pipelineId}`)
    if (persistenceMode === 'supabase' && isSupabaseConfigured()) {
      const result = await deletePipelineRemote(getSupabaseBrowserClient(), pipelineId)
      if (!result.ok) {
        setBusyAction(null)
        setActionError(result.error)
        return
      }
      if (result.mode === 'local') {
        switchToLocalMode(result.message)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['crm', 'configuracoes', 'pipelines'] })
        setBusyAction(null)
        setNotice('Funil excluído no Supabase.')
        return
      }
    }
    setLocalPipelines((prev) => prev.filter((item) => item.id !== pipelineId))
    setLocalStages((prev) => prev.filter((item) => item.pipeline_id !== pipelineId))
    setBusyAction(null)
    setNotice('Funil removido da sessão local.')
  }

  async function removeStage(stageId: string) {
    const confirmed = window.confirm('Excluir esta etapa?')
    if (!confirmed) return
    setActionError(null)
    setNotice(null)
    setBusyAction(`stage-delete-${stageId}`)
    if (persistenceMode === 'supabase' && isSupabaseConfigured()) {
      const result = await deleteStageRemote(getSupabaseBrowserClient(), stageId)
      if (!result.ok) {
        setBusyAction(null)
        setActionError(result.error)
        return
      }
      if (result.mode === 'local') {
        switchToLocalMode(result.message)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['crm', 'configuracoes', 'pipelines'] })
        setBusyAction(null)
        setNotice('Etapa excluída no Supabase.')
        return
      }
    }
    setLocalStages((prev) => prev.filter((item) => item.id !== stageId))
    setBusyAction(null)
    setNotice('Etapa removida da sessão local.')
  }

  function removeFormTemplate(formId: string) {
    const confirmed = window.confirm('Excluir este modelo de formulário?')
    if (!confirmed) return
    setForms((prev) => prev.filter((item) => item.id !== formId))
    setNotice('Modelo removido da sessão local.')
  }

  async function copyFormLink(slug: string) {
    const url = `${window.location.origin}/formulario/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice(`Link copiado: ${url}`)
    } catch {
      setNotice(`Link de referência: ${url}`)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="border-2 border-primary bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">
              Governança
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-primary md:text-3xl">
              Configurações do CRM
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Cadastre funis, etapas e modelos de formulário usando o padrão side-over. Funis e etapas
              persistem em Supabase quando as tabelas estiverem disponíveis.
            </p>
          </div>
        </div>

        {settingsQuery.isPending ? (
          <p className="mt-6 text-sm font-medium text-on-surface-variant">A carregar configurações…</p>
        ) : null}
        {settingsQuery.isError ? (
          <p className="mt-6 border-2 border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : 'Erro ao carregar configurações.'}
          </p>
        ) : null}

        {persistenceMessage ? (
          <div className="mt-6 border-2 border-amber-300 bg-amber-50 p-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
            {persistenceMessage}
          </div>
        ) : null}
        <div className="mt-3 border-2 border-sky-200 bg-sky-50 p-3 text-xs font-semibold uppercase tracking-[0.12em] text-sky-900">
          Modelos de formulário: persistência local (MVP), integração backend pendente.
        </div>
        {actionError ? (
          <p className="mt-3 border-2 border-red-300 bg-red-50 p-3 text-sm text-red-900">{actionError}</p>
        ) : null}
        {notice ? (
          <p className="mt-3 border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            {notice}
          </p>
        ) : null}

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-primary">Funis</h2>
            <button
              type="button"
              className="inline-flex items-center gap-2 border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface"
              onClick={openPipelineCreate}
            >
              <span className="material-symbols-outlined text-base">add</span>
              Novo funil
            </button>
          </div>
          <div className="hub-table-scrollbar mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-[10px] font-black uppercase tracking-[0.15em] text-secondary">
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Slug</th>
                  <th className="py-3 pr-4">Etapas</th>
                  <th className="py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-on-surface-variant">
                      Nenhum funil cadastrado.
                    </td>
                  </tr>
                ) : null}
                {pipelines.map((pipeline) => (
                  <tr
                    key={pipeline.id}
                    className="border-b border-outline-variant/60 transition hover:bg-surface/80"
                  >
                    <td className="py-3 pr-4 font-semibold text-primary">{pipeline.name}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{pipeline.slug}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">
                      {stages.filter((stage) => stage.pipeline_id === pipeline.id).length}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Editar"
                          onClick={() => openPipelineEdit(pipeline)}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Ver etapas"
                          onClick={() => setStagePipelineFilter(pipeline.id)}
                        >
                          <span className="material-symbols-outlined text-base">link</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir"
                          disabled={busyAction === `pipeline-delete-${pipeline.id}`}
                          onClick={() => void removePipeline(pipeline.id)}
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-primary">Etapas</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-2 border-primary px-3 py-2 text-xs font-semibold text-primary"
                value={stagePipelineFilter}
                onChange={(event) => setStagePipelineFilter(event.target.value)}
              >
                <option value="all">Todos os funis</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex items-center gap-2 border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface"
                onClick={openStageCreate}
                disabled={pipelines.length === 0}
              >
                <span className="material-symbols-outlined text-base">add</span>
                Nova etapa
              </button>
            </div>
          </div>
          <div className="hub-table-scrollbar mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-[10px] font-black uppercase tracking-[0.15em] text-secondary">
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Funil</th>
                  <th className="py-3 pr-4">Slug</th>
                  <th className="py-3 pr-4">Posição</th>
                  <th className="py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-on-surface-variant">
                      Nenhuma etapa para o filtro selecionado.
                    </td>
                  </tr>
                ) : null}
                {stageRows.map((stage) => (
                  <tr key={stage.id} className="border-b border-outline-variant/60 transition hover:bg-surface/80">
                    <td className="py-3 pr-4 font-semibold text-primary">{stage.name}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">
                      {pipelineNameById.get(stage.pipeline_id) ?? 'Funil não encontrado'}
                    </td>
                    <td className="py-3 pr-4 text-on-surface-variant">{stage.slug}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{stage.position}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Editar"
                          onClick={() => openStageEdit(stage)}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Filtrar pelo funil"
                          onClick={() => setStagePipelineFilter(stage.pipeline_id)}
                        >
                          <span className="material-symbols-outlined text-base">link</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir"
                          disabled={busyAction === `stage-delete-${stage.id}`}
                          onClick={() => void removeStage(stage.id)}
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-primary">Modelos de formulário</h2>
            <button
              type="button"
              className="inline-flex items-center gap-2 border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface"
              onClick={openFormCreate}
            >
              <span className="material-symbols-outlined text-base">add</span>
              Novo modelo
            </button>
          </div>
          <div className="hub-table-scrollbar mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-[10px] font-black uppercase tracking-[0.15em] text-secondary">
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Slug</th>
                  <th className="py-3 pr-4">Campos</th>
                  <th className="py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-on-surface-variant">
                      Nenhum modelo criado nesta sessão.
                    </td>
                  </tr>
                ) : null}
                {forms.map((form) => (
                  <tr key={form.id} className="border-b border-outline-variant/60 transition hover:bg-surface/80">
                    <td className="py-3 pr-4 font-semibold text-primary">{form.name}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{form.slug}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{form.fields.length}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Editar"
                          onClick={() => openFormEdit(form)}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-primary/25 text-primary hover:bg-surface"
                          title="Copiar link"
                          onClick={() => void copyFormLink(form.slug)}
                        >
                          <span className="material-symbols-outlined text-base">link</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-red-300 text-red-700 hover:bg-red-50"
                          title="Excluir"
                          onClick={() => removeFormTemplate(form.id)}
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <SideOver
        open={drawer !== null}
        title={
          drawer?.kind === 'pipeline'
            ? drawer.mode === 'create'
              ? 'Novo funil'
              : 'Editar funil'
            : drawer?.kind === 'stage'
              ? drawer.mode === 'create'
                ? 'Nova etapa'
                : 'Editar etapa'
              : drawer?.mode === 'create'
                ? 'Novo modelo de formulário'
                : 'Editar modelo de formulário'
        }
        description={
          drawer?.kind === 'form'
            ? 'Campos básicos em estado local até a camada backend estar disponível.'
            : 'Preencha os dados e salve para aplicar a configuração.'
        }
        onClose={() => setDrawer(null)}
      >
        {drawer?.kind === 'pipeline' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void savePipeline()
            }}
          >
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Nome
              <input
                value={pipelineDraft.name}
                onChange={(event) =>
                  setPipelineDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                    slug: prev.slug ? prev.slug : slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="Triagem HUB"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Slug
              <input
                value={pipelineDraft.slug}
                onChange={(event) =>
                  setPipelineDraft((prev) => ({
                    ...prev,
                    slug: slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="triagem-hub"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                onClick={() => setDrawer(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="border-2 border-primary bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                disabled={busyAction === 'pipeline-save'}
              >
                Salvar
              </button>
            </div>
          </form>
        ) : null}

        {drawer?.kind === 'stage' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void saveStage()
            }}
          >
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Funil
              <select
                value={stageDraft.pipeline_id}
                onChange={(event) =>
                  setStageDraft((prev) => ({ ...prev, pipeline_id: event.target.value }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
              >
                <option value="">Selecione</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Nome
              <input
                value={stageDraft.name}
                onChange={(event) =>
                  setStageDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                    slug: prev.slug ? prev.slug : slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="Contato inicial"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Slug
              <input
                value={stageDraft.slug}
                onChange={(event) =>
                  setStageDraft((prev) => ({
                    ...prev,
                    slug: slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="contato-inicial"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Posição
              <input
                type="number"
                min={1}
                value={stageDraft.position}
                onChange={(event) =>
                  setStageDraft((prev) => ({
                    ...prev,
                    position: Number(event.target.value || 1),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                onClick={() => setDrawer(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="border-2 border-primary bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                disabled={busyAction === 'stage-save'}
              >
                Salvar
              </button>
            </div>
          </form>
        ) : null}

        {drawer?.kind === 'form' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveFormTemplate()
            }}
          >
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Nome
              <input
                value={formDraft.name}
                onChange={(event) =>
                  setFormDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                    slug: prev.slug ? prev.slug : slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="Formulário de captação"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Slug
              <input
                value={formDraft.slug}
                onChange={(event) =>
                  setFormDraft((prev) => ({
                    ...prev,
                    slug: slugify(event.target.value),
                  }))
                }
                className="mt-2 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="captacao-padrao"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Descrição
              <textarea
                value={formDraft.description}
                onChange={(event) =>
                  setFormDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                className="mt-2 min-h-20 w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                placeholder="Uso interno e objetivo do formulário."
              />
            </label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">Campos</p>
                <button
                  type="button"
                  className="border border-primary px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                  onClick={() =>
                    setFormDraft((prev) => ({
                      ...prev,
                      fields: [
                        ...prev.fields,
                        { id: createLocalId('field'), label: '', type: 'text', required: false },
                      ],
                    }))
                  }
                >
                  Adicionar campo
                </button>
              </div>
              {formDraft.fields.map((field) => (
                <div key={field.id} className="space-y-2 border border-outline-variant/60 p-3">
                  <input
                    value={field.label}
                    onChange={(event) =>
                      setFormDraft((prev) => ({
                        ...prev,
                        fields: prev.fields.map((item) =>
                          item.id === field.id ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                    className="w-full border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                    placeholder="Rótulo do campo"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(event) =>
                        setFormDraft((prev) => ({
                          ...prev,
                          fields: prev.fields.map((item) =>
                            item.id === field.id
                              ? { ...item, type: event.target.value as FormFieldType }
                              : item,
                          ),
                        }))
                      }
                      className="flex-1 border-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                    >
                      {fieldTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          setFormDraft((prev) => ({
                            ...prev,
                            fields: prev.fields.map((item) =>
                              item.id === field.id ? { ...item, required: event.target.checked } : item,
                            ),
                          }))
                        }
                      />
                      Obrigatório
                    </label>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center border border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() =>
                        setFormDraft((prev) => ({
                          ...prev,
                          fields: prev.fields.filter((item) => item.id !== field.id),
                        }))
                      }
                      title="Excluir campo"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                onClick={() => setDrawer(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="border-2 border-primary bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        ) : null}
      </SideOver>
    </div>
  )
}

type SideOverProps = {
  open: boolean
  title: string
  description: string
  children: React.ReactNode
  onClose: () => void
}

function SideOver({ open, title, description, children, onClose }: SideOverProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="h-full flex-1 bg-primary/20"
        onClick={onClose}
        aria-label="Fechar painel lateral"
      />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-primary bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-outline-variant/60 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Side-over</p>
            <h3 className="mt-2 text-xl font-black text-primary">{title}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center border-2 border-primary text-primary"
            onClick={onClose}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
