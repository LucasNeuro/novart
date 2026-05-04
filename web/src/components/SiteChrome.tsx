import { useMatches, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from './Footer'
import Header from './Header'

function isStandaloneRoute(routeId: string | undefined, pathname: string): boolean {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  if (routeId === '/login' || routeId === '/cadastro' || routeId === '/acesso') return true
  if (routeId === '/acesso-pendente') return true
  if (routeId === '/crm' || routeId === '/crm/' || (routeId?.startsWith('/crm/') ?? false)) return true
  if (p === '/login' || p === '/cadastro' || p === '/acesso' || p === '/acesso-pendente' || p.startsWith('/crm'))
    return true
  return false
}

/**
 * Cabeçalho e rodapé do site público — omitidos em rotas “standalone” (ex.: login).
 * Usa o routeId da folha (via `useMatches`) porque, no SSR/streaming do Start, o `pathname`
 * pode desincronizar momentaneamente e empilhar header + página inteira.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const matches = useMatches()
  const leafRouteId = matches.at(-1)?.routeId
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const standalone = isStandaloneRoute(leafRouteId, pathname)

  if (standalone) {
    return <>{children}</>
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}

/** TanStack Devtools em todas as rotas (em build de produção o plugin remove este código). */
export function AppDevtools() {
  return (
    <TanStackDevtools
      config={{
        position: 'bottom-right',
      }}
      plugins={[
        {
          name: 'Tanstack Router',
          render: <TanStackRouterDevtoolsPanel />,
        },
      ]}
    />
  )
}
