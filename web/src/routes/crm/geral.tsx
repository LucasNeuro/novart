import { createFileRoute } from '@tanstack/react-router'
import CrmBoardPage from '../../components/crm/CrmBoardPage'

export const Route = createFileRoute('/crm/geral')({
  component: CrmGeralPage,
})

function CrmGeralPage() {
  return <CrmBoardPage segment="geral" />
}
