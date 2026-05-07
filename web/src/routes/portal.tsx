import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured } from '../lib/env'
import { loadPortalBoardData, movePipelineLead, type KanbanColumn, type PipelineLead } from '../lib/portal/pipeline-geral'
import Obra10Logo from '../components/Obra10Logo'

type PortalTab = 'visao' | 'kanban' | 'leads' | 'segmentos'
type ExtendedPortalTab = PortalTab | 'executivo' | 'eficiencia' | 'scorecard'

export const Route = createFileRoute('/portal')({
  component: PortalPage,
})

const portalTabs: Array<{ id: ExtendedPortalTab; label: string; icon: string }> = [
  { id: 'visao', label: 'Visão geral', icon: 'monitoring' },
  { id: 'executivo', label: 'Sumário executivo', icon: 'insights' },
  { id: 'eficiencia', label: 'Eficiência do funil', icon: 'tune' },
  { id: 'scorecard', label: 'Farol score card', icon: 'traffic' },
  { id: 'kanban', label: 'CRM Kanban', icon: 'view_kanban' },
  { id: 'leads', label: 'Leads', icon: 'group' },
  { id: 'segmentos', label: 'Segmentos', icon: 'category' },
]

function ratio(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function formatDateTime(raw: string): string {
  const value = new Date(raw)
  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatOptionalDate(raw: string | null): string {
  if (!raw) return 'Sem registro'
  return formatDateTime(raw)
}

function farolChipClass(farol: 'verde' | 'amarelo' | 'vermelho') {
  if (farol === 'verde') return 'border-[#00c853]/40 bg-[#e8fff2] text-[#008c3a]'
  if (farol === 'amarelo') return 'border-[#ffca28]/50 bg-[#fff8e1] text-[#9a6c00]'
  return 'border-[#ef9a9a]/50 bg-[#fff1f1] text-[#b32929]'
}

function statCard(
  title: string,
  value: string | number,
  helper: string,
  detail: string,
  highlighted = false,
) {
  return (
    <article
      className={`border p-4 ${highlighted ? 'border-[#00c853]/50 bg-[#061729] text-white' : 'border-[#d7e0eb] bg-white text-[#13263b]'}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{title}</p>
      <p className="mt-2 text-3xl font-black leading-none">{value}</p>
      <p className="mt-3 text-xs font-semibold opacity-90">{helper}</p>
      <p className="mt-1 text-[11px] opacity-70">{detail}</p>
    </article>
  )
}

function leadCard(lead: PipelineLead) {
  return (
    <div className="border border-[#d7e0eb] bg-white p-3 shadow-[0_2px_8px_rgba(15,31,52,0.07)]">
      <p className="truncate text-sm font-black text-[#10263e]">{lead.nome}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-[#4b627f]">{lead.email ?? 'Sem e-mail'}</p>
      <p className="truncate text-[11px] font-medium text-[#4b627f]">{lead.telefone ?? 'Sem telefone'}</p>
      <p className="mt-2 line-clamp-2 text-xs text-[#3b526d]">{lead.resumo ?? 'Sem resumo no payload.'}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="border border-[#d7e0eb] bg-[#f7faff] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#234264]">
          {lead.segmento}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#00a846]">
          {lead.potencial ?? 'Potencial n/d'}
        </span>
      </div>
    </div>
  )
}

function PortalPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ExtendedPortalTab>('visao')
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = useState<string | null>(null)

  const configured = isSupabaseConfigured()
  const supabase = configured ? getSupabaseBrowserClient() : null

  const portalQuery = useQuery({
    queryKey: ['portal', 'pipeline-geral'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        await navigate({ to: '/login', replace: true, search: { redirect: '/portal' } })
        throw new Error('Sessão expirada.')
      }
      return loadPortalBoardData(supabase)
    },
    staleTime: 30_000,
  })

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, column }: { leadId: string; column: KanbanColumn }) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      await movePipelineLead(supabase, leadId, column)
      return { leadId, column }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'pipeline-geral'] })
    },
  })

  const data = portalQuery.data
  const groupedColumns = useMemo(() => {
    if (!data) return []
    return data.columns.map((column) => ({
      ...column,
      leads: data.leads.filter((lead) =>
        column.stageId ? lead.stageId === column.stageId : lead.status === column.slug,
      ),
    }))
  }, [data])

  useEffect(() => {
    document.documentElement.classList.add('portal-no-scroll')
    document.body.classList.add('portal-no-scroll')
    return () => {
      document.documentElement.classList.remove('portal-no-scroll')
      document.body.classList.remove('portal-no-scroll')
    }
  }, [])

  const boardInsights = useMemo(() => {
    if (!data) {
      return {
        newLeads: 0,
        inProgressLeads: 0,
        closedLeads: 0,
        conversionRate: '0%',
        topSegments: [] as Array<{ segmento: string; total: number; share: string }>,
        latestUpdates: [] as PipelineLead[],
      }
    }
    const newLeads = data.leads.filter((lead) => lead.status === 'novo').length
    const closedLeads =
      data.advanced.closedLeads ||
      data.leads.filter((lead) =>
        ['fechado', 'won', 'ganho', 'concluido', 'concluído'].includes(lead.status.toLowerCase()),
      ).length
    const inProgressLeads = Math.max(data.leads.length - newLeads - closedLeads, 0)
    const topSegments = data.stats.segmentCounts.slice(0, 3).map((row) => ({
      ...row,
      share: ratio(row.total, data.stats.totalLeads),
    }))
    const latestUpdates = data.leads.slice(0, 6)
    return {
      newLeads,
      inProgressLeads,
      closedLeads,
      conversionRate:
        data.advanced.closeRatePercent === null
          ? ratio(closedLeads, data.stats.totalLeads)
          : `${Math.round(data.advanced.closeRatePercent)}%`,
      topSegments,
      latestUpdates,
    }
  }, [data])

  function onDropLead(column: KanbanColumn) {
    if (!draggingLeadId) return
    setDropColumnId(null)
    setDraggingLeadId(null)
    void moveMutation.mutateAsync({ leadId: draggingLeadId, column })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#eff3f8] text-[#10263f]">
      <header className="sticky top-0 z-40 border-b-2 border-primary bg-white/95 px-4 backdrop-blur-sm">
        <nav className="flex w-full flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:py-4">
          <h2 className="m-0 min-w-0 flex-shrink-0">
            <Link to="/" className="inline-flex items-center no-underline">
              <Obra10Logo heightClass="h-8 sm:h-9" />
            </Link>
          </h2>

          <div className="order-2 flex w-full flex-wrap items-center justify-end gap-2 sm:order-3 sm:ml-auto sm:w-auto">
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['portal', 'pipeline-geral'] })}
              className="inline-flex items-center justify-center border-2 border-primary bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary no-underline transition hover:bg-surface sm:px-5"
            >
              Atualizar dados
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!supabase) return
                await supabase.auth.signOut()
                await navigate({ to: '/login', replace: true })
              }}
              className="inline-flex items-center justify-center border-2 border-primary bg-tertiary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline shadow-sm transition hover:brightness-105 sm:px-5"
            >
              Sair
            </button>
          </div>
        </nav>
      </header>

      <section className="shrink-0 border-b border-[#d6e0ec] bg-[#0a1b2f] text-white">
        <div className="w-full px-4 py-4 md:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00c853]">Portal HUB</p>
          <h1 className="text-[clamp(1.35rem,2.4vw,2rem)] font-black tracking-tight">Performance e CRM operacional</h1>
          <p className="text-xs font-medium text-white/75">
            Painel completo com indicadores executivos, abas operacionais e Kanban de negócios.
          </p>
        </div>
      </section>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-5 md:px-6 md:py-6">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {!configured && (
          <div className="border border-[#ffca28] bg-[#fff8df] px-4 py-3 text-sm font-semibold text-[#6d4c00]">
            Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para carregar o portal.
          </div>
        )}
        {portalQuery.error && (
          <div className="border border-[#f8c2c2] bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7d1d1d]">
            {portalQuery.error.message}
          </div>
        )}

        <section className="shrink-0 border border-[#d6e0ec] bg-white p-2">
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
            {portalTabs.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    active
                      ? 'border-[#00c853] bg-[#0a1b2f] text-white'
                      : 'border-[#d6e0ec] bg-white text-[#253d59] hover:bg-[#f5f9ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </section>

        {data && activeTab === 'visao' && (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {statCard('Total de leads', data.stats.totalLeads, 'Volume geral', `${boardInsights.newLeads} novos no ciclo`)}
              {statCard('Potencial alto', data.stats.highPotentialLeads, 'Carteira prioritária', `${ratio(data.stats.highPotentialLeads, data.stats.totalLeads)} da base`)}
              {statCard('Em andamento', boardInsights.inProgressLeads, 'Oportunidades ativas', `${ratio(boardInsights.inProgressLeads, data.stats.totalLeads)} do funil`)}
              {statCard('Fechados', boardInsights.closedLeads, 'Resultados concluídos', `Taxa atual ${boardInsights.conversionRate}`)}
              {statCard('Etapas ativas', data.stats.activeStages, 'Modelo operacional', 'Distribuição por estágios')}
              {statCard('Atualizados hoje', data.stats.updatedToday, 'Ritmo de execução', 'Monitoramento diário', true)}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {boardInsights.topSegments.map((segment) => (
                <article key={segment.segmento} className="border border-[#d6e0ec] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="inline-flex border border-[#dbe5f2] bg-[#f7faff] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#1b3757]">
                      {segment.segmento}
                    </p>
                    <p className="text-xl font-black text-[#00a846]">{segment.share}</p>
                  </div>
                  <p className="mt-3 text-3xl font-black text-[#10263f]">{segment.total}</p>
                  <p className="text-xs font-semibold text-[#5f7793]">Participação no panorama geral</p>
                  <div className="mt-4 h-2 w-full overflow-hidden bg-[#e8eef7]">
                    <div className="h-full bg-[#00c853]" style={{ width: segment.share }} />
                  </div>
                </article>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <article className="border border-[#d6e0ec] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#324c69]">Leads por segmento</p>
                <div className="mt-4 space-y-2">
                  {data.stats.segmentCounts.length === 0 ? (
                    <p className="text-sm text-[#5a738f]">Sem dados de segmento.</p>
                  ) : (
                    data.stats.segmentCounts.map((row) => (
                      <div key={row.segmento} className="flex items-center justify-between border border-[#e4ebf3] px-3 py-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#1c3552]">{row.segmento}</p>
                        <p className="text-sm font-black text-[#00a846]">{row.total}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="border border-[#d6e0ec] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#324c69]">Prioridades e insights</p>
                <div className="mt-4 space-y-2">
                  {boardInsights.latestUpdates.map((lead, index) => (
                    <div key={lead.id} className="flex items-start justify-between gap-3 border border-[#e4ebf3] bg-[#f9fbff] p-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.1em] text-[#143456]">
                          {index + 1}. {lead.nome}
                        </p>
                        <p className="mt-1 text-[11px] text-[#4d6683]">{lead.resumo ?? 'Sem resumo informado.'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#00a846]">
                          {lead.status}
                        </p>
                        <p className="mt-1 text-[11px] text-[#5d7692]">{formatDateTime(lead.updatedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <article className="border border-[#d6e0ec] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#324c69]">Painel IA e operação</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ['Última sessão', formatOptionalDate(data.advanced.lastSessionAt)],
                    ['Última mensagem', formatOptionalDate(data.advanced.lastMessageAt)],
                    ['Último imóvel atualizado', formatOptionalDate(data.advanced.lastImovelUpdateAt)],
                    ['Último evento', formatOptionalDate(data.advanced.lastDomainEventAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-[#e4ebf3] bg-[#f9fbff] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#44607f]">{label}</p>
                      <p className="mt-1 text-sm font-bold text-[#183655]">{value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="border border-[#d6e0ec] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#324c69]">Tempo médio por segmento (dias)</p>
                <div className="mt-3 space-y-2">
                  {data.advanced.segmentTempo.length === 0 ? (
                    <p className="text-sm text-[#5a738f]">Sem dados de tempo médio.</p>
                  ) : (
                    data.advanced.segmentTempo.map((row) => (
                      <div key={row.segmento} className="grid grid-cols-3 gap-2 border border-[#e4ebf3] bg-[#f9fbff] px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#173655]">{row.segmento}</p>
                        <p className="text-[11px] font-semibold text-[#4b6582]">
                          Criação: {row.avgDaysSinceCreated === null ? '-' : row.avgDaysSinceCreated.toFixed(1)}
                        </p>
                        <p className="text-[11px] font-semibold text-[#4b6582]">
                          Atualização: {row.avgDaysSinceUpdate === null ? '-' : row.avgDaysSinceUpdate.toFixed(1)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        )}

        {data && activeTab === 'executivo' && (
          <section className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="h-6 w-1 bg-[#00c853]" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1a3658]">Sumário executivo</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {statCard('Investimento total', data.stats.totalLeads, 'Base ativa', `${boardInsights.newLeads} novas entradas`)}
              {statCard('Retorno (ROAS médio)', boardInsights.conversionRate, 'Eficiência geral', `${boardInsights.closedLeads} concluídos`, true)}
              {statCard('Custo por conversão', `${Math.max(1, data.stats.totalLeads - boardInsights.closedLeads)}`, 'Ciclo atual', 'Indicador operacional')}
              {statCard('Conversões totais', boardInsights.closedLeads, 'Fechamentos', `Taxa ${boardInsights.conversionRate}`)}
              {statCard('Campanhas ativas', boardInsights.inProgressLeads, 'Pipeline em andamento', `${ratio(boardInsights.inProgressLeads, data.stats.totalLeads)} do total`)}
              {statCard('Prioridade alta / insights', data.stats.highPotentialLeads, 'Leads prioritários', `${ratio(data.stats.highPotentialLeads, data.stats.totalLeads)} da carteira`)}
            </div>

            <article className="border border-[#d6e0ec] bg-white p-4">
              <div className="inline-flex items-center gap-2">
                <span className="h-5 w-1 bg-[#00c853]" />
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1a3658]">Comparativo por canal e eficiência</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {data.stats.segmentCounts.slice(0, 3).map((segment, index) => (
                  <article key={segment.segmento} className="border border-[#e2eaf4] bg-[#fbfdff] p-4">
                    <p className="inline-flex border border-[#d7e3f2] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#1c395b]">
                      {index === 0 ? 'Canal A' : index === 1 ? 'Canal B' : 'Canal C'}
                    </p>
                    <p className="mt-3 text-3xl font-black text-[#10263f]">{segment.total}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#4b6582]">Volume do segmento {segment.segmento}</p>
                    <div className="mt-4 h-2 overflow-hidden bg-[#e8eef7]">
                      <div className="h-full bg-[#00c853]" style={{ width: ratio(segment.total, data.stats.totalLeads) }} />
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        )}

        {data && activeTab === 'eficiencia' && (
          <section className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="h-6 w-1 bg-[#00c853]" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1a3658]">Eficiência do funil de conversão</p>
            </div>
            <article className="border border-[#0f233f] bg-gradient-to-r from-[#071627] to-[#0a2038] p-5 text-white">
              <div className="grid gap-4 md:grid-cols-3">
                {data.advanced.stageDistribution.slice(0, 3).map((stage, index) => (
                  <div key={stage.stage} className="border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">{index + 1}. {stage.stage}</p>
                    <p className="mt-2 text-4xl font-black">{stage.total}</p>
                    <p className="text-xs font-semibold text-[#00d15a]">{stage.sharePercent}% do funil</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-[#d6e0ec] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <span className="h-5 w-1 bg-[#00c853]" />
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1a3658]">Detalhamento de campanhas ativas</p>
                </div>
                <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#00a846]">
                  <span className="h-2 w-2 bg-[#00c853]" /> Alta performance
                </p>
              </div>
              <div className="max-h-[46dvh] overflow-auto border border-[#e4ebf3]">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#f4f8fd] text-[10px] font-black uppercase tracking-[0.13em] text-[#2f4968]">
                    <tr>
                      <th className="px-3 py-2">Campanha / ID</th>
                      <th className="px-3 py-2">Canal</th>
                      <th className="px-3 py-2">Leads</th>
                      <th className="px-3 py-2">Participação</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.advanced.stageDistribution.map((stage) => (
                      <tr key={stage.stage} className="border-t border-[#edf2f8]">
                        <td className="px-3 py-2 font-bold text-[#16314f]">{stage.stage}</td>
                        <td className="px-3 py-2 text-[#3d5672]">Pipeline</td>
                        <td className="px-3 py-2 text-[#10263f]">{stage.total}</td>
                        <td className="px-3 py-2 text-[#00a846]">{stage.sharePercent}%</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex border border-[#00c853]/30 bg-[#e9fff3] px-2 py-1 text-[10px] font-black uppercase tracking-[0.11em] text-[#009a41]">
                            ativa
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {data && activeTab === 'scorecard' && (
          <section className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="h-6 w-1 bg-[#00c853]" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1a3658]">Farol score card por tipo de lead</p>
            </div>
            <article className="border border-[#d6e0ec] bg-white p-4">
              <div className="max-h-[58dvh] overflow-auto border border-[#e4ebf3]">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#f4f8fd] text-[10px] font-black uppercase tracking-[0.13em] text-[#2f4968]">
                    <tr>
                      <th className="px-3 py-2">Tipo de lead</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Alto potencial</th>
                      <th className="px-3 py-2">Últimos 7 dias</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Farol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.advanced.leadKindScores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#5f7894]">
                          Sem dados de tipos de lead para score card.
                        </td>
                      </tr>
                    ) : (
                      data.advanced.leadKindScores.map((row) => (
                        <tr key={row.leadKind} className="border-t border-[#edf2f8]">
                          <td className="px-3 py-2 font-bold uppercase tracking-[0.08em] text-[#16314f]">{row.leadKind}</td>
                          <td className="px-3 py-2">{row.total}</td>
                          <td className="px-3 py-2 text-[#00a846]">{row.highPotential}</td>
                          <td className="px-3 py-2">{row.newLast7d}</td>
                          <td className="px-3 py-2 font-black text-[#10263f]">{row.score}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${farolChipClass(row.farol)}`}>
                              {row.farol}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {data && activeTab === 'kanban' && (
          <section className="flex h-[72dvh] min-h-0 flex-col space-y-3">
            <p className="text-xs font-semibold text-[#415a78]">Arraste os cards entre colunas para mover o negócio no funil.</p>
            <div className="min-h-0 flex-1 overflow-x-auto">
              <div className="grid h-full min-w-[1200px] grid-cols-4 gap-3">
              {groupedColumns.map((column) => (
                <article
                  key={column.id}
                  className={`flex min-h-0 flex-col border bg-[#f7faff] p-3 transition ${dropColumnId === column.id ? 'border-[#00c853]' : 'border-[#d7e0eb]'}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropColumnId(column.id)
                  }}
                  onDragLeave={() => setDropColumnId((curr) => (curr === column.id ? null : curr))}
                  onDrop={(e) => {
                    e.preventDefault()
                    onDropLead(column)
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#1b3654]">{column.title}</h3>
                    <span className="text-xs font-black text-[#00a846]">{column.leads.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {column.leads.length === 0 ? (
                      <div className="border border-dashed border-[#d1dbe8] bg-white p-3 text-center text-xs text-[#6b819a]">
                        Solte um lead aqui
                      </div>
                    ) : (
                      column.leads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggingLeadId(lead.id)}
                          onDragEnd={() => {
                            setDraggingLeadId(null)
                            setDropColumnId(null)
                          }}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          {leadCard(lead)}
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))}
              </div>
            </div>
          </section>
        )}

        {data && activeTab === 'leads' && (
          <section className="border border-[#d7e0eb] bg-white">
            <div className="grid grid-cols-12 border-b border-[#d7e0eb] bg-[#f7faff] px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#2f4968]">
              <p className="col-span-3">Lead</p>
              <p className="col-span-2">Contato</p>
              <p className="col-span-3">Resumo</p>
              <p className="col-span-2">Segmento</p>
              <p className="col-span-2">Status</p>
            </div>
            <div className="max-h-[62dvh] overflow-auto">
              {data.leads.map((lead) => (
                <div key={lead.id} className="grid grid-cols-12 border-b border-[#edf2f8] px-3 py-2 text-xs">
                  <div className="col-span-3">
                    <p className="font-bold text-[#16314f]">{lead.nome}</p>
                    <p className="text-[11px] text-[#5f7894]">{lead.email ?? 'Sem e-mail'}</p>
                  </div>
                  <p className="col-span-2 text-[#3d5672]">{lead.telefone ?? '-'}</p>
                  <p className="col-span-3 line-clamp-2 text-[#3d5672]">{lead.resumo ?? '-'}</p>
                  <p className="col-span-2">
                    <span className="border border-[#d7e0eb] bg-[#f7faff] px-2 py-1 text-[10px] font-black uppercase tracking-[0.11em]">
                      {lead.segmento}
                    </span>
                  </p>
                  <p className="col-span-2 text-[#00a846]">{lead.status}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data && activeTab === 'segmentos' && (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.stats.segmentCounts.map((item) => (
              <article key={item.segmento} className="border border-[#d7e0eb] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#4d6582]">{item.segmento}</p>
                <p className="mt-2 text-3xl font-black text-[#10263f]">{item.total}</p>
                <p className="mt-2 text-xs font-semibold text-[#5e7692]">Visibilidade estratégica do segmento no painel.</p>
              </article>
            ))}
          </section>
        )}

        {(portalQuery.isLoading || moveMutation.isPending) && (
          <div className="border border-[#d6e0ec] bg-white px-4 py-3 text-xs font-semibold text-[#2f4968]">
            {portalQuery.isLoading ? 'A carregar painel...' : 'A atualizar card no Kanban...'}
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
