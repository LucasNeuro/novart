import { createFileRoute } from '@tanstack/react-router'
import CrmSectionPlaceholder from '../../components/crm/CrmSectionPlaceholder'

export const Route = createFileRoute('/crm/produtos')({
  component: CrmProdutosPage,
})

function CrmProdutosPage() {
  return (
    <CrmSectionPlaceholder
      eyebrow="Produtos"
      title="Gestao de produtos"
      description="Secao inicial para organizar SKU, portfolio comercial e indicadores de performance por produto."
    />
  )
}
