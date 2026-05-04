import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-primary bg-white/95 px-4 backdrop-blur-sm">
      <nav className="landing-wrap flex flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-xs font-black uppercase tracking-[0.2em] text-primary">
          <Link
            to="/"
            className="inline-flex items-center gap-2 no-underline text-primary"
          >
            <span className="material-symbols-outlined text-tertiary" aria-hidden>
              home
            </span>
            <span>
              Obra10<span className="text-tertiary">+</span>
            </span>
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
          <Link
            to="/about"
            className="text-on-surface-variant no-underline transition hover:text-primary"
            activeProps={{ className: 'text-primary' }}
          >
            A Obra10+
          </Link>
        </div>

        <div className="order-2 flex w-full justify-end sm:order-3 sm:ml-auto sm:w-auto">
          <Link
            to="/login"
            className="inline-flex items-center justify-center border-2 border-primary bg-tertiary px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline shadow-sm transition hover:brightness-105 active:brightness-95"
          >
            Entrar
          </Link>
        </div>
      </nav>
    </header>
  )
}
