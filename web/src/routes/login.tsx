import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured } from '../lib/env'
import Obra10Logo from '../components/Obra10Logo'
import { resolvePostLoginNavigation } from '../lib/auth/post-login'
import { queryKeys } from '../lib/query-keys'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (raw: Record<string, unknown>): LoginSearch => ({
    redirect: typeof raw.redirect === 'string' ? raw.redirect : undefined,
  }),
  component: LoginPage,
})

const IMG_LOGIN_PANEL =
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2000&q=80'

function friendlySupabaseMessage(raw: string): string {
  const m = raw.trim()
  if (m === 'Invalid login credentials') return 'Credenciais inválidas.'
  if (m.includes('Database error querying schema')) {
    return 'Erro ao falar com a API Postgres (PostgREST). 1) Correr supabase/obra10_hub_init.sql (tabela public.profiles, RPCs). 2) NOTIFY pgrst, \'reload schema\'; 3) .env com URL e anon key corretos. 4) Logs → API.'
  }
  return m
}

function LoginPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect } = Route.useSearch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const configured = isSupabaseConfigured()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (!configured) {
        setError('Supabase não está configurado neste ambiente.')
        return
      }

      setLoading(true)
      try {
        const supabase = getSupabaseBrowserClient()
        const { error: signError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signError) {
          setError(friendlySupabaseMessage(signError.message))
          return
        }

        // Garante JWT atualizado no cliente antes da RPC / PostgREST (evita falhas logo após o sign-in).
        const { error: userErr } = await supabase.auth.getUser()
        if (userErr) {
          setError(friendlySupabaseMessage(userErr.message))
          return
        }

        const nav = await resolvePostLoginNavigation(supabase, redirect)
        if (!nav.ok) {
          if (nav.signOut) await supabase.auth.signOut()
          setError(friendlySupabaseMessage(nav.message))
          return
        }

        if (nav.path.startsWith('/portal')) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.portalBoard })
        }
        await router.invalidate()
        await navigate({ to: nav.path })
      } finally {
        setLoading(false)
      }
    },
    [configured, email, navigate, password, queryClient, redirect, router],
  )

  return (
    <div className="flex min-h-dvh min-h-[100dvh] w-full flex-col overflow-x-hidden bg-white lg:flex-row">
      {/* Painel editorial — empilhado em mobile; coluna à esquerda em desktop */}
      <aside className="login-auth-panel relative flex min-h-[min(38vh,280px)] w-full shrink-0 flex-col justify-between px-4 py-6 text-white sm:min-h-[260px] sm:px-8 sm:py-8 lg:min-h-dvh lg:w-[44%] lg:max-w-[560px] lg:px-10 lg:py-12">
        <div
          className="login-auth-photo"
          style={{ backgroundImage: `url(${IMG_LOGIN_PANEL})` }}
          role="img"
          aria-label="Canteiro de obras em preto e branco"
        />
        <div className="login-auth-overlay" aria-hidden />

        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/90 no-underline transition hover:text-tertiary"
          >
            <span className="material-symbols-outlined text-xl text-tertiary" aria-hidden>
              arrow_back
            </span>
            Voltar ao site
          </Link>
          <div className="mt-6 flex items-center sm:mt-10">
            <Obra10Logo onDark heightClass="h-9 sm:h-10" />
          </div>
        
          <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-white/85">
            Acesso exclusivo para equipas e parceiros autorizados. Utilize as credenciais fornecidas
            pela sua organização.
          </p>
        </div>

        <p className="relative z-10 mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 lg:mt-0">
          Uso autorizado · confidencial
        </p>
      </aside>

      {/* Formulário */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-center px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="border border-outline-variant/80 bg-surface/30 px-5 py-7 shadow-[0_24px_48px_-12px_rgba(11,22,34,0.12)] backdrop-blur-[2px] sm:px-10 sm:py-10">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Entrar</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-primary sm:text-2xl">
              Bem-vindo de volta
            </h2>
            <p className="mt-4 text-xs font-medium leading-relaxed text-on-surface-variant">
              Inicie sessão com o e-mail registado no Supabase. Após autenticar, você entra no portal
              operacional com dashboards e CRM Kanban.
            </p>

            {!configured && (
              <p className="mt-4 border-2 border-primary/20 bg-white/80 p-3 text-xs font-medium text-primary">
                Defina <code className="text-[11px]">VITE_SUPABASE_URL</code> e{' '}
                <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> no ficheiro{' '}
                <code className="text-[11px]">web/.env.local</code> (veja <code className="text-[11px]">.env.example</code>).
              </p>
            )}

            {error && (
              <p className="mt-4 break-words rounded-sm border-2 border-red-800/30 bg-red-50/90 p-3 text-xs font-medium leading-snug text-red-900 text-pretty">
                {error}
              </p>
            )}

            <form className="mt-8 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                  E-mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="seu@empresa.com.br"
                  disabled={!configured || loading}
                  className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-base text-on-surface outline-none transition placeholder:text-on-surface-variant/70 sm:text-sm disabled:opacity-60"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                  Senha
                </span>
                <div className="relative mt-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="••••••••"
                    disabled={!configured || loading}
                    className="min-h-11 w-full border-2 border-outline-variant bg-white py-2.5 pl-3.5 pr-12 text-base text-on-surface outline-none transition placeholder:text-on-surface-variant/70 sm:text-sm disabled:opacity-60"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={!configured || loading}
                    className="absolute right-0 top-0 flex min-h-11 w-12 min-w-12 items-center justify-center rounded-sm text-on-surface-variant outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <span className="material-symbols-outlined text-[22px]" aria-hidden>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={!configured || loading}
                className="min-h-12 w-full border-2 border-primary bg-tertiary py-3.5 text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'A entrar…' : 'Entrar'}
              </button>
            </form>
          </div>

            <p className="mt-6 px-1 text-center text-xs font-medium text-on-surface-variant sm:mt-8">
              Novo utilizador?{' '}
              <Link to="/cadastro" className="font-bold text-tertiary no-underline hover:underline">
                Criar conta
              </Link>
            </p>
        </div>
      </div>
    </div>
  )
}
