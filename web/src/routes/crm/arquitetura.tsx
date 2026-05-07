import { createFileRoute } from '@tanstack/react-router'
import CrmSectionPlaceholder from '../../components/crm/CrmSectionPlaceholder'

export const Route = createFileRoute('/crm/arquitetura')({
  component: CrmArquiteturaPage,
})

function CrmArquiteturaPage() {
  return (
    <CrmSectionPlaceholder
      eyebrow="Arquitetura"
      title="Pipeline de arquitetura"
      description="Area reservada para briefing tecnico, estudos preliminares e acompanhamento das etapas de projeto."
    />
  )
}
