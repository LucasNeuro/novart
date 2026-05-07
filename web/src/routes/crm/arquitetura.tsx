import { createFileRoute } from '@tanstack/react-router'
import CrmBoardPage from '../../components/crm/CrmBoardPage'

export const Route = createFileRoute('/crm/arquitetura')({
  component: CrmArquiteturaPage,
})

function CrmArquiteturaPage() {
  return <CrmBoardPage segment="arquitetura" />
}
