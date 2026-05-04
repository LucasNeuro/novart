import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import Obra10Logo from '../components/Obra10Logo'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured } from '../lib/env'

export const Route = createFileRoute('/acesso-pendente')({
  component: AcessoPendentePage,
})

function AcessoPendentePage() {
  const navigate = useNavigate()

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
        <h1 className="mt-3 text-xl font-black text-primary md:text-2xl">Aprovação pendente</h1>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          O seu pedido de acesso como <strong className="text-primary">administrador HUB</strong> foi
          recebido. O <strong className="text-primary">owner</strong> da plataforma precisa de
          aprovar antes de aceder ao CRM.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="inline-flex justify-center border-2 border-primary bg-tertiary px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-105"
            onClick={() => void signOut()}
          >
            Sair
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center border-2 border-primary bg-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary no-underline hover:bg-surface"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  )
}
