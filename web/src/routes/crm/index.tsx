import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTriageBoard } from '../../lib/crm/triage-data'
import { queryKeys } from '../../lib/query-keys'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'

export const Route = createFileRoute('/crm/')({
  component: CrmTriagemHome,
})

function stageName(stages: { id: string; name: string }[], stageId: string) {
  return stages.find((s) => s.id === stageId)?.name ?? '—'
}

function CrmTriagemHome() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.triageLeads,
    queryFn: () => fetchTriageBoard(getSupabaseBrowserClient()),
  })

  const leads = data?.leads ?? []
  const stages = data?.stages ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <div className="border-2 border-primary bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Triagem</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-primary md:text-3xl">
              Fila de leads
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-on-surface-variant">
              Dados em cache com TanStack Query (atualização ao focar a janela ou ao tocar em Recarregar).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.triageLeads })}
            disabled={isPending || isFetching}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start border-2 border-primary bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface disabled:opacity-50 sm:self-auto"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              refresh
            </span>
            Recarregar
          </button>
        </div>

        {isPending && (
          <p className="mt-8 text-sm font-medium text-on-surface-variant">A carregar a fila…</p>
        )}

        {isError && (
          <div
            className="mt-8 border-2 border-red-800/30 bg-red-50/90 p-4 text-sm font-medium text-red-900"
            role="alert"
          >
            {error instanceof Error ? error.message : 'Erro ao carregar leads.'}
            <button
              type="button"
              className="ml-3 font-black uppercase tracking-wider underline"
              onClick={() => void refetch()}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!isPending && !isError && leads.length === 0 && (
          <div className="mt-8 border-2 border-dashed border-outline-variant bg-surface/50 px-6 py-10 text-center">
            <p className="text-sm font-bold text-primary">Nenhum lead na fila</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Quando existirem leads no pipeline de triagem, eles surgem aqui automaticamente. Em
              desenvolvimento pode inserir um registo de teste pelo SQL Editor ou esperar integrações
              de formulário / canal.
            </p>
          </div>
        )}

        {!isPending && !isError && leads.length > 0 && (
          <div className="hub-table-scrollbar mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-[10px] font-black uppercase tracking-[0.15em] text-secondary">
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Etapa</th>
                  <th className="py-3 pr-4">Origem</th>
                  <th className="py-3 pr-4">Classificação</th>
                  <th className="py-3">Criado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-outline-variant/60 transition hover:bg-surface/80"
                  >
                    <td className="max-w-[200px] py-3 pr-4 font-semibold text-primary">
                      <span className="line-clamp-2">
                        {lead.display_name?.trim() || 'Sem nome'}
                      </span>
                      {lead.summary ? (
                        <span className="mt-1 line-clamp-2 block text-xs font-normal text-on-surface-variant">
                          {lead.summary}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-on-surface-variant">
                      {stageName(stages, lead.stage_id)}
                    </td>
                    <td className="py-3 pr-4 font-medium uppercase tracking-wider text-on-surface-variant">
                      {lead.source}
                    </td>
                    <td className="py-3 pr-4 text-on-surface-variant">
                      {lead.hub_classification ?? '—'}
                    </td>
                    <td className="py-3 text-on-surface-variant">
                      {new Date(lead.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
