import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import Obra10Logo from '../components/Obra10Logo'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured } from '../lib/env'

export const Route = createFileRoute('/acesso')({
  component: AcessoPage,
})

/**
 * Utilizador autenticado sem perfil de administrador HUB — ponto de entrada para futuros
 * painéis por organização / convite.
 */
function AcessoPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!isSupabaseConfigured()) {
        await navigate({ to: '/login' })
        return
      }
      const supabase = getSupabaseBrowserClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session?.user) {
        await navigate({ to: '/login' })
        return
      }
      setEmail(session.user.email ?? null)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await getSupabaseBrowserClient().auth.signOut()
    }
    await navigate({ to: '/login' })
  }, [navigate])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-lg border-2 border-primary bg-white p-8 text-center shadow-lg">
        <div className="flex justify-center">
          <Obra10Logo heightClass="h-10" className="justify-center" />
        </div>
        <h1 className="mt-3 text-xl font-black text-primary md:text-2xl">A sua conta está ativa</h1>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          Este e-mail tem sessão válida mas <strong className="text-primary">não</strong> está
          configurado como <strong className="text-primary">administrador HUB</strong>. Aqui
          entrarão, em breve, os painéis por organização e permissões finer‑grained (apenas o que o
          seu perfil pode ver).
        </p>
        {email ? (
          <p className="mt-4 text-xs font-medium text-on-surface-variant">
            Sessão: <span className="text-primary">{email}</span>
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex justify-center border-2 border-primary bg-tertiary px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary no-underline transition hover:brightness-105"
          >
            Conteúdo institucional
          </Link>
          <button
            type="button"
            className="inline-flex justify-center border-2 border-primary bg-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface"
            onClick={() => void signOut()}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
