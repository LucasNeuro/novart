import { Link, useRouterState } from '@tanstack/react-router'
import Obra10Logo from './Obra10Logo'

export default function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const norm = (pathname || '/').replace(/\/$/, '') || '/'
  const onAuthStandalone = norm === '/login' || norm === '/cadastro'
  return (
    <header className="sticky top-0 z-50 border-b-2 border-primary bg-white/95 px-4 backdrop-blur-sm">
      <nav className="landing-wrap flex flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:py-4">
        <h2 className="m-0 min-w-0 flex-shrink-0">
          <Link to="/" className="inline-flex items-center no-underline">
            <Obra10Logo heightClass="h-8 sm:h-9" />
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-black uppercase tracking-[0.2em] sm:order-2 sm:mx-auto sm:w-auto sm:justify-start">
          <Link
            to="/"
            className="text-on-surface-variant no-underline transition hover:text-primary"
            activeProps={{ className: 'text-primary' }}
          >
            Início
          </Link>
          <a
            href="/#como-funciona"
            className="text-on-surface-variant no-underline transition hover:text-primary"
          >
            Como funciona
          </a>
          <a
            href="/#plataforma"
            className="text-on-surface-variant no-underline transition hover:text-primary"
          >
            Plataforma
          </a>
          <a
            href="/#plataforma"
            className="text-on-surface-variant no-underline transition hover:text-primary"
          >
            A Obra10+
          </a>
        </div>

        <div className="order-2 flex w-full flex-wrap items-center justify-end gap-2 sm:order-3 sm:ml-auto sm:w-auto">
          {onAuthStandalone ? (
            <>
              {norm === '/cadastro' ? (
                <span className="inline-flex items-center justify-center border-2 border-primary/40 bg-tertiary/50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/90 sm:px-5">
                  Cadastrar
                </span>
              ) : (
                <Link
                  to="/cadastro"
                  className="inline-flex items-center justify-center border-2 border-primary bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary no-underline transition hover:bg-surface sm:px-5"
                >
                  Cadastrar
                </Link>
              )}
              {norm === '/login' ? (
                <span className="inline-flex items-center justify-center border-2 border-primary/40 bg-tertiary/50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/90 sm:px-5">
                  Entrar
                </span>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center border-2 border-primary bg-tertiary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline shadow-sm transition hover:brightness-105 sm:px-5"
                >
                  Entrar
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/cadastro"
                className="inline-flex items-center justify-center border-2 border-primary bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary no-underline transition hover:bg-surface sm:px-5"
              >
                Cadastrar
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center border-2 border-primary bg-tertiary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline shadow-sm transition hover:brightness-105 sm:px-5"
              >
                Entrar
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
