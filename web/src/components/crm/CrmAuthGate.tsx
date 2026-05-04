import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { checkHubAdminAccess } from '../../lib/auth/hub-admin'
import { isSupabaseConfigured } from '../../lib/env'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'
import CrmAppShell from './CrmAppShell'

type CrmAuthGateProps = {
  children: React.ReactNode
}

/**
 * Protecção ao nível do cliente: Supabase Auth + linha em hub_admins (alinhado ao RLS actual).
 */
export default function CrmAuthGate({ children }: CrmAuthGateProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<
    'loading' | 'ready' | 'forbidden' | 'unauthenticated'
  >('loading')
  const [email, setEmail] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) await navigate({ to: '/login' })
        return
      }

      const supabase = getSupabaseBrowserClient()
      const result = await checkHubAdminAccess(supabase)
      if (cancelled) return

      if (!result.ok) {
        if (result.reason === 'no_session') {
          setState('unauthenticated')
          await navigate({ to: '/login', search: { redirect: '/crm' } })
          return
        }
        if (result.reason === 'not_hub_admin') {
          setState('forbidden')
          return
        }
        setState('forbidden')
        return
      }

      setEmail(result.email)
      setState('ready')
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (state === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface text-on-surface">
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Obra10+</p>
          <p className="mt-3 text-sm font-bold text-primary">A carregar o painel…</p>
        </div>
      </div>
    )
  }

  if (state === 'forbidden') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
        <p className="text-lg font-black text-primary">Sem acesso de administrador HUB</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          A sua conta tem sessão válida, mas ainda não está na lista de administradores. Peça a um
          responsável para associar o seu utilizador a <code className="text-xs">hub_admins</code>{' '}
          no Supabase.
        </p>
        <button
          type="button"
          className="border-2 border-primary bg-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary"
          onClick={() => void navigate({ to: '/login' })}
        >
          Voltar ao login
        </button>
      </div>
    )
  }

  if (state !== 'ready') {
    return null
  }

  return <CrmAppShell userEmail={email}>{children}</CrmAppShell>
}
