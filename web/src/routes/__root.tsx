import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import SiteChrome, { AppDevtools } from '../components/SiteChrome'
import { getQueryClient } from '../lib/query-client'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center text-on-surface">
      <p className="text-lg font-black text-primary">Página não encontrada</p>
      <Link to="/" className="text-sm font-bold text-tertiary underline">
        Voltar ao início
      </Link>
    </div>
  ),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Obra10+ HUB',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body className="bg-surface font-sans text-on-surface antialiased">
        <QueryClientProvider client={getQueryClient()}>
          <SiteChrome>{children}</SiteChrome>
          <AppDevtools />
          {import.meta.env.DEV ? (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          ) : null}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
