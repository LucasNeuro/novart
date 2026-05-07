import { createFileRoute } from '@tanstack/react-router'
import CrmBoardPage from '../../components/crm/CrmBoardPage'

export const Route = createFileRoute('/crm/imobiliaria')({
  component: CrmImobiliariaPage,
})

function CrmImobiliariaPage() {
  return <CrmBoardPage segment="imobiliaria" />
}
