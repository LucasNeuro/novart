import type { CrmLead } from '../../lib/crm/board-data'

type CrmLeadTableProps = {
  leads: CrmLead[]
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CrmLeadTable({ leads }: CrmLeadTableProps) {
  return (
    <div className="hub-table-scrollbar mt-6 overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-primary text-[10px] font-black uppercase tracking-[0.15em] text-secondary">
            <th className="py-3 pr-4">Lead</th>
            <th className="py-3 pr-4">Segmento</th>
            <th className="py-3 pr-4">Etapa</th>
            <th className="py-3 pr-4">Origem</th>
            <th className="py-3 pr-4">Classificacao</th>
            <th className="py-3 pr-4">Atualizado</th>
            <th className="py-3">Criado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-outline-variant/60 transition hover:bg-surface/80">
              <td className="max-w-[280px] py-3 pr-4 align-top font-semibold text-primary">
                <span className="line-clamp-2">{lead.display_name}</span>
                {lead.summary ? (
                  <span className="mt-1 block line-clamp-2 text-xs font-normal text-on-surface-variant">
                    {lead.summary}
                  </span>
                ) : null}
              </td>
              <td className="py-3 pr-4 text-on-surface-variant">{lead.segment ?? '—'}</td>
              <td className="py-3 pr-4 text-on-surface-variant">{lead.stage_name}</td>
              <td className="py-3 pr-4 font-medium uppercase tracking-wider text-on-surface-variant">
                {lead.source}
              </td>
              <td className="py-3 pr-4 text-on-surface-variant">{lead.classification ?? '—'}</td>
              <td className="py-3 pr-4 text-on-surface-variant">{formatDate(lead.updated_at)}</td>
              <td className="py-3 text-on-surface-variant">{formatDate(lead.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
