import { createFileRoute } from '@tanstack/react-router'
import CrmSectionPlaceholder from '../../components/crm/CrmSectionPlaceholder'

export const Route = createFileRoute('/crm/servicos')({
  component: CrmServicosPage,
})

function CrmServicosPage() {
  return (
    <CrmSectionPlaceholder
      eyebrow="Servicos"
      title="Catalogo de servicos"
      description="Espaco para operacoes de servicos recorrentes, SLA e status de execucao por cliente."
    />
  )
}
