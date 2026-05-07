import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCrmBoardData } from '../../lib/crm/board-data'
import { queryKeys } from '../../lib/query-keys'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'
import CrmKanbanBoard from './CrmKanbanBoard'
import CrmLeadTable from './CrmLeadTable'
import CrmSegmentTabs from './CrmSegmentTabs'
import { leadBelongsToSegment, type CrmSegmentKey } from './crm-segments'
import CrmViewModeToggle, { type CrmViewMode } from './CrmViewModeToggle'

type CrmBoardPageProps = {
  segment: CrmSegmentKey
}

function sourceLabel(source: 'pipeline_geral' | 'triage_fallback') {
  return source === 'pipeline_geral' ? 'pipeline_geral' : 'triage_leads + pipeline_stages'
}

export default function CrmBoardPage({ segment }: CrmBoardPageProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<CrmViewMode>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.crmBoard,
    queryFn: () => fetchCrmBoardData(getSupabaseBrowserClient()),
  })

  const allLeads = data?.leads ?? []
  const leadsBySegment = useMemo(
    () => allLeads.filter((lead) => leadBelongsToSegment(segment, lead.segment)),
    [allLeads, segment],
  )

  const stageOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const stage of data?.stages ?? []) map.set(stage.id, stage.name)
    for (const lead of leadsBySegment) {
      if (!map.has(lead.stage_id)) map.set(lead.stage_id, lead.stage_name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [data?.stages, leadsBySegment])

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return leadsBySegment.filter((lead) => {
      if (stageFilter !== 'all' && lead.stage_id !== stageFilter) return false
      if (!q) return true
      const haystack = [lead.display_name, lead.summary ?? '', lead.segment ?? '', lead.source]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [leadsBySegment, searchTerm, stageFilter])

  return (
    <div className="mx-auto max-w-7xl">
      <section className="border-2 border-primary bg-white p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">CRM Geral</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-primary md:text-3xl">
          Visao de leads por segmento
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-medium text-on-surface-variant">
          Filtros rapidos, visualizacao em tabela/kanban e abas por segmento na mesma estrutura.
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Fonte de dados ativa: <span className="font-bold text-primary">{sourceLabel(data?.source ?? 'triage_fallback')}</span>
        </p>

        <CrmSegmentTabs activeSegment={segment} />

        <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.9fr_auto_auto] md:items-end">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Busca</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nome, segmento, resumo ou origem"
              className="mt-1 min-h-11 w-full border border-outline-variant px-3 text-sm outline-none transition focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Etapa</span>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="mt-1 min-h-11 w-full border border-outline-variant bg-white px-3 text-sm outline-none transition focus:border-primary"
            >
              <option value="all">Todas as etapas</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>

          <CrmViewModeToggle mode={mode} onChange={setMode} />

          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.crmBoard })}
            disabled={isPending || isFetching}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-primary bg-white px-4 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition hover:bg-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              refresh
            </span>
            Recarregar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span>
            {filteredLeads.length} lead(s) em <strong>{mode === 'table' ? 'Tabela' : 'Kanban'}</strong>
          </span>
          {(searchTerm || stageFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setStageFilter('all')
              }}
              className="border border-outline-variant px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant transition hover:border-primary hover:text-primary"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isPending && <p className="mt-6 text-sm font-medium text-on-surface-variant">A carregar leads...</p>}

        {isError && (
          <div className="mt-6 border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error instanceof Error ? error.message : 'Erro ao carregar dados do CRM.'}
            <button type="button" onClick={() => void refetch()} className="ml-3 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}

        {!isPending && !isError && filteredLeads.length === 0 && (
          <div className="mt-6 border border-dashed border-outline-variant bg-surface/50 px-6 py-10 text-center">
            <p className="text-sm font-bold text-primary">Sem leads para os filtros atuais</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Ajuste busca/etapa ou troque de segmento para visualizar outros cards.
            </p>
          </div>
        )}

        {!isPending && !isError && filteredLeads.length > 0 && (
          <>
            {mode === 'table' ? (
              <CrmLeadTable leads={filteredLeads} />
            ) : (
              <CrmKanbanBoard stages={data?.stages ?? []} leads={filteredLeads} />
            )}
          </>
        )}
      </section>
    </div>
  )
}
