import { createFileRoute } from '@tanstack/react-router'
import CrmSectionPlaceholder from '../../components/crm/CrmSectionPlaceholder'

export const Route = createFileRoute('/crm/imobiliaria')({
  component: CrmImobiliariaPage,
})

function CrmImobiliariaPage() {
  return (
    <CrmSectionPlaceholder
      eyebrow="Imobiliaria"
      title="Gestao imobiliaria"
      description="Modulo base preparado para carteira de imoveis, proprietarios e visitas. Estrutura inicial em layout Obra10+."
    />
  )
}
