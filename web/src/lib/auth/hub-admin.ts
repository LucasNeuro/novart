import type { SupabaseClient } from '@supabase/supabase-js'

export type HubAccessResult =
  | { ok: true; userId: string; email: string | undefined; role: string }
  | {
      ok: false
      reason:
        | 'no_session'
        | 'not_configured'
        | 'not_hub_admin'
        | 'pending_approval'
        | 'rejected'
        | 'no_profile'
        | 'error'
      message?: string
    }

function rpcReturnsTrue(data: unknown): boolean {
  return data === true || data === 'true'
}

/**
 * Sincroniza perfil, lê role/aprovação e verifica acesso ao CRM (owner | hub_admin aprovados).
 */
export async function checkHubAdminAccess(supabase: SupabaseClient): Promise<HubAccessResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { ok: false, reason: 'error', message: userError.message }
  }
  if (!user) {
    return { ok: false, reason: 'no_session' }
  }

  const sync = await supabase.rpc('ensure_profile')
  if (sync.error) {
    return { ok: false, reason: 'error', message: sync.error.message }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, approval_status')
    .eq('auth_subject', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, reason: 'error', message: profileError.message }
  }
  if (!profile) {
    return { ok: false, reason: 'no_profile' }
  }

  if (profile.approval_status === 'rejected') {
    return { ok: false, reason: 'rejected', message: 'O seu pedido de acesso ao HUB foi recusado.' }
  }

  if (profile.role === 'hub_admin' && profile.approval_status === 'pending') {
    return { ok: false, reason: 'pending_approval' }
  }

  const rpc = await supabase.rpc('is_hub_admin')
  if (rpc.error) {
    return { ok: false, reason: 'error', message: rpc.error.message }
  }
  if (rpcReturnsTrue(rpc.data)) {
    return { ok: true, userId: user.id, email: user.email, role: profile.role }
  }

  return { ok: false, reason: 'not_hub_admin' }
}
