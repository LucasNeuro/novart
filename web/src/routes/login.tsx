import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured } from '../lib/env'
import { checkHubAdminAccess } from '../lib/auth/hub-admin'

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

function LoginPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { redirect } = Route.useSearch()
  const target = redirect?.startsWith('/') ? redirect : '/crm'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
          setError(signError.message === 'Invalid login credentials' ? 'Credenciais inválidas.' : signError.message)
          return
        }

        const access = await checkHubAdminAccess(supabase)
        if (!access.ok) {
          await supabase.auth.signOut()
          if (access.reason === 'not_hub_admin') {
            setError('Esta conta não tem perfil de administrador HUB. Contacte a equipa responsável.')
          } else {
            setError('Não foi possível validar o seu acesso. Tente novamente.')
          }
          return
        }

        await router.invalidate()
        await navigate({ to: target })
      } finally {
        setLoading(false)
      }
    },
    [configured, email, navigate, password, router, target],
  )

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-white lg:flex-row">
      {/* Painel editorial — alinhado à identidade da landing (P&B + overlay) */}
      <aside className="login-auth-panel relative flex min-h-[220px] w-full shrink-0 flex-col justify-between px-7 py-8 text-white sm:min-h-[260px] lg:min-h-dvh lg:w-[44%] lg:max-w-[560px] lg:px-10 lg:py-12">
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
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/90 no-underline transition hover:text-tertiary"
          >
            <span className="material-symbols-outlined text-xl text-tertiary" aria-hidden>
              arrow_back
            </span>
            Voltar ao site
          </Link>
          <div className="mt-10 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary" aria-hidden>
              home
            </span>
            <span className="text-sm font-black tracking-tight text-white">
              Obra10<span className="text-tertiary">+</span>
            </span>
          </div>
          <h1 className="mt-4 max-w-md text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[1.85rem]">
            Área do <span className="text-tertiary">cliente</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-white/85">
            Acesso exclusivo para equipas e parceiros autorizados. Utilize as credenciais fornecidas
            pela sua organização.
          </p>
        </div>

        <p className="relative z-10 mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 lg:mt-0">
          Uso autorizado · confidencial
        </p>
      </aside>

      {/* Formulário */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="border border-outline-variant/80 bg-surface/30 px-8 py-9 shadow-[0_24px_48px_-12px_rgba(11,22,34,0.12)] backdrop-blur-[2px] sm:px-10 sm:py-10">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Entrar</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-primary sm:text-2xl">
              Bem-vindo de volta
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Inicie sessão com o e-mail registado no Supabase. Só contas promovidas a{' '}
              <span className="font-semibold text-primary">administrador HUB</span> acedem ao CRM.
            </p>

            {!configured && (
              <p className="mt-4 border-2 border-primary/20 bg-white/80 p-3 text-xs font-medium text-primary">
                Defina <code className="text-[11px]">VITE_SUPABASE_URL</code> e{' '}
                <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> no ficheiro{' '}
                <code className="text-[11px]">web/.env.local</code> (veja <code className="text-[11px]">.env.example</code>).
              </p>
            )}

            {error && (
              <p className="mt-4 border-2 border-red-800/30 bg-red-50/90 p-3 text-xs font-medium text-red-900">
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
                  className="mt-2 w-full border-2 border-outline-variant bg-white px-3.5 py-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/70 disabled:opacity-60"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                  Senha
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="••••••••"
                  disabled={!configured || loading}
                  className="mt-2 w-full border-2 border-outline-variant bg-white px-3.5 py-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/70 disabled:opacity-60"
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={!configured || loading}
                className="w-full border-2 border-primary bg-tertiary py-3.5 text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'A entrar…' : 'Entrar'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs font-medium text-on-surface-variant">
            Precisa de contexto sobre a plataforma?{' '}
            <Link to="/about" className="font-bold text-tertiary no-underline hover:underline">
              Conheça a Obra10+
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
