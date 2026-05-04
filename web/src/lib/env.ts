/**
 * Variáveis públicas (prefixo VITE_). Nunca colocar service role aqui.
 */
export const publicEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** URL pública da app (ex.: https://seu-servico.onrender.com). Usada no link de confirmação de e-mail. */
  appOrigin: import.meta.env.VITE_APP_ORIGIN ?? '',
} as const

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}
