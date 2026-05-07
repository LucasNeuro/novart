import { createFileRoute } from '@tanstack/react-router'
import CrmBoardPage from '../../components/crm/CrmBoardPage'

export const Route = createFileRoute('/crm/servicos')({
  component: CrmServicosPage,
})

function CrmServicosPage() {
  return <CrmBoardPage segment="servicos" />
}
