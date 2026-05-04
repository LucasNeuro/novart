import { checkHubAdminAccess } from './hub-admin'

export type PostLoginNavigation =
  | { ok: true; path: string; isHubAdmin: boolean }
  | { ok: false; message: string; signOut: boolean }

/**
 * Após login: CRM para equipa HUB aprovada; pendente/rejeitado tratados à parte;
 * cliente → /acesso; sem perfil → completar cadastro.
 */
export async function resolvePostLoginNavigation(
  supabase: Parameters<typeof checkHubAdminAccess>[0],
  requestedRedirect: string | undefined,
): Promise<PostLoginNavigation> {
  const access = await checkHubAdminAccess(supabase)

  if (access.ok) {
    if (requestedRedirect?.startsWith('/crm')) {
      return { ok: true, path: requestedRedirect, isHubAdmin: true }
    }
    return { ok: true, path: '/crm', isHubAdmin: true }
  }

  if (access.reason === 'not_hub_admin') {
    return { ok: true, path: '/acesso', isHubAdmin: false }
  }

  if (access.reason === 'pending_approval') {
    return { ok: true, path: '/acesso-pendente', isHubAdmin: false }
  }

  if (access.reason === 'no_profile') {
    return { ok: true, path: '/cadastro', isHubAdmin: false }
  }

  if (access.reason === 'rejected' && access.message) {
    return { ok: false, message: access.message, signOut: true }
  }

  if (access.reason === 'error' && access.message) {
    return { ok: false, message: access.message, signOut: true }
  }

  if (access.reason === 'no_session') {
    return { ok: false, message: 'Sessão inválida após o login.', signOut: true }
  }

  return { ok: false, message: 'Não foi possível validar o seu acesso.', signOut: true }
}
