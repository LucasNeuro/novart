import { Outlet, createFileRoute } from '@tanstack/react-router'
import CrmAuthGate from '../../components/crm/CrmAuthGate'

export const Route = createFileRoute('/crm')({
  component: CrmLayout,
})

function CrmLayout() {
  return (
    <CrmAuthGate>
      <Outlet />
    </CrmAuthGate>
  )
}
