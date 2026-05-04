import type { SupabaseClient } from '@supabase/supabase-js'

export type HubAccessResult =
  | { ok: true; userId: string; email: string | undefined }
  | { ok: false; reason: 'no_session' | 'not_configured' | 'not_hub_admin' | 'error'; message?: string }

/**
 * Verifica sessão Supabase e existência em public.hub_admins (RLS: só a própria linha).
 */
export async function checkHubAdminAccess(
  supabase: SupabaseClient,
): Promise<HubAccessResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    return { ok: false, reason: 'error', message: sessionError.message }
  }
  if (!session?.user) {
    return { ok: false, reason: 'no_session' }
  }

  const { data, error } = await supabase
    .from('hub_admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (error) {
    return { ok: false, reason: 'error', message: error.message }
  }
  if (!data) {
    return { ok: false, reason: 'not_hub_admin' }
  }

  return {
    ok: true,
    userId: session.user.id,
    email: session.user.email,
  }
}
