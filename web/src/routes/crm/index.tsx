import { createFileRoute } from '@tanstack/react-router'
import CrmSectionPlaceholder from '../../components/crm/CrmSectionPlaceholder'

export const Route = createFileRoute('/crm/')({
  component: CrmDashboardHome,
})

const metricCards = [
  { label: 'Leads ativos', value: '128', delta: '+12% vs. semana passada' },
  { label: 'Propostas em andamento', value: '42', delta: '8 aguardando aprovacao' },
  { label: 'Taxa de conversao', value: '18.4%', delta: '+1.6 p.p. no mes' },
  { label: 'Tickets de suporte', value: '9', delta: '3 com prioridade alta' },
] as const

function CrmDashboardHome() {
  return (
    <div className="space-y-6">
      <CrmSectionPlaceholder
        eyebrow="Dashboard"
        title="Painel principal"
        description="Visao consolidada de vendas, operacao e funil. Estes indicadores sao placeholders visuais para a primeira entrega do painel CRM."
      />

      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="border-2 border-primary/20 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-primary">{card.value}</p>
            <p className="mt-2 text-xs font-medium text-on-surface-variant">{card.delta}</p>
          </article>
        ))}
      </div>

      <div className="mx-auto max-w-6xl border-2 border-outline-variant bg-white p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Proximos blocos</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Espaco reservado para pipeline, tarefas e atividades recentes. A navegacao lateral ja permite
          evoluir cada modulo por area de negocio sem alterar o fluxo de autenticacao.
        </p>
      </div>
    </div>
  )
}
