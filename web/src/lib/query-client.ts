import { QueryClient } from '@tanstack/react-query'

function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  })
}

const globalObj = globalThis as unknown as { __obra10_query_client?: QueryClient }

/**
 * Cliente TanStack Query: um por instância no browser; em SSR cada pedido
 * obtém um cliente novo (sem partilha entre utilizadores).
 */
export function getQueryClient() {
  if (typeof window === 'undefined') {
    return createAppQueryClient()
  }
  if (!globalObj.__obra10_query_client) {
    globalObj.__obra10_query_client = createAppQueryClient()
  }
  return globalObj.__obra10_query_client
}
