import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import SiteChrome, { AppDevtools } from '../components/SiteChrome'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
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
        <SiteChrome>{children}</SiteChrome>
        <AppDevtools />
        <Scripts />
      </body>
    </html>
  )
}
