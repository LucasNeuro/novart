import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, publicEnv } from '../env'

const globalObj = globalThis as unknown as { __obra10_supabase?: SupabaseClient }

/**
 * Cliente browser (anon key + RLS), uma única instância no cliente para evitar
 * "Multiple GoTrueClient instances" e sessão inconsistente.
 * Em SSR devolve sempre uma instância descartável (sem persistência).
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja web/.env.example).',
    )
  }

  const url = publicEnv.supabaseUrl.trim().replace(/\/+$/, '')
  const key = publicEnv.supabaseAnonKey.trim()

  if (typeof window === 'undefined') {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  if (!globalObj.__obra10_supabase) {
    globalObj.__obra10_supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return globalObj.__obra10_supabase
}
