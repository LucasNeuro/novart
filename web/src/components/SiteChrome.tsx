import { useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from './Footer'
import Header from './Header'

/**
 * Cabeçalho e rodapé do site público — omitidos em rotas “standalone” (ex.: login).
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const standalone = pathname === '/login' || pathname.startsWith('/crm')

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
