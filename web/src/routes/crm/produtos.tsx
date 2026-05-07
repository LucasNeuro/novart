import { createFileRoute } from '@tanstack/react-router'
import CrmBoardPage from '../../components/crm/CrmBoardPage'

export const Route = createFileRoute('/crm/produtos')({
  component: CrmProdutosPage,
})

function CrmProdutosPage() {
  return <CrmBoardPage segment="produtos" />
}
