import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, publicEnv } from '../env'

/**
 * Cliente browser (anon key + RLS). Usar só após sessão quando políticas exigirem JWT.
 */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja web/.env.example).',
    )
  }

  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
