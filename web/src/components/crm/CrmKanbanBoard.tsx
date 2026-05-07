import type { CrmLead, CrmStage } from '../../lib/crm/board-data'

type CrmKanbanBoardProps = {
  stages: CrmStage[]
  leads: CrmLead[]
}

export default function CrmKanbanBoard({ stages, leads }: CrmKanbanBoardProps) {
  const stageById = new Map<string, CrmLead[]>()
  for (const stage of stages) {
    stageById.set(stage.id, [])
  }

  for (const lead of leads) {
    if (!stageById.has(lead.stage_id)) {
      stageById.set(lead.stage_id, [])
    }
    stageById.get(lead.stage_id)?.push(lead)
  }

  const orderedStages: CrmStage[] = [...stages]
  for (const [stageId, stageLeads] of stageById) {
    if (orderedStages.some((stage) => stage.id === stageId)) continue
    orderedStages.push({
      id: stageId,
      name: stageLeads[0]?.stage_name ?? 'Sem etapa',
      position: Number.MAX_SAFE_INTEGER,
    })
  }

  return (
    <div className="hub-table-scrollbar mt-6 overflow-x-auto pb-2">
      <div className="grid min-w-[920px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {orderedStages.map((stage) => {
          const cards = stageById.get(stage.id) ?? []
          return (
            <section key={stage.id} className="flex min-h-[220px] flex-col border border-outline-variant bg-surface/50">
              <header className="border-b border-outline-variant bg-white px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                  {stage.name}
                </p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{cards.length} leads</p>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {cards.length === 0 ? (
                  <div className="border border-dashed border-outline-variant bg-white/70 p-3 text-xs text-on-surface-variant">
                    Sem cards nesta etapa.
                  </div>
                ) : (
                  cards.map((lead) => (
                    <article key={lead.id} className="border border-primary/15 bg-white p-3">
                      <p className="text-sm font-bold text-primary">{lead.display_name}</p>
                      {lead.summary ? (
                        <p className="mt-1 line-clamp-3 text-xs text-on-surface-variant">{lead.summary}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span className="border border-outline-variant px-2 py-1 text-on-surface-variant">
                          {lead.source}
                        </span>
                        {lead.segment ? (
                          <span className="border border-outline-variant px-2 py-1 text-on-surface-variant">
                            {lead.segment}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
