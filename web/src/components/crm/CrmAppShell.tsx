import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import Obra10Logo from '../Obra10Logo'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'
import { isSupabaseConfigured } from '../../lib/env'

const navItems = [
  { to: '/crm' as const, label: 'Dashboard', icon: 'dashboard' },
  { to: '/crm/geral' as const, label: 'CRM Geral', icon: 'account_tree' },
  { to: '/crm/imobiliaria' as const, label: 'Imobiliaria', icon: 'home_work' },
  { to: '/crm/arquitetura' as const, label: 'Arquitetura', icon: 'architecture' },
  { to: '/crm/servicos' as const, label: 'Servicos', icon: 'handyman' },
  { to: '/crm/produtos' as const, label: 'Produtos', icon: 'inventory_2' },
  { to: '/crm/configuracoes' as const, label: 'Configuracoes', icon: 'settings' },
] as const

type CrmAppShellProps = {
  children: React.ReactNode
  userEmail?: string
}

export default function CrmAppShell({ children, userEmail }: CrmAppShellProps) {
  const [expanded, setExpanded] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const toggleSidebar = useCallback(() => setExpanded((e) => !e), [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
    }
    await navigate({ to: '/login' })
  }, [navigate])

  const sidebarW = expanded ? 'w-64' : 'w-[76px]'
  const activeItem =
    navItems.find((item) =>
      item.to === '/crm' ? location.pathname === '/crm' : location.pathname.startsWith(item.to),
    ) ?? navItems[0]

  return (
    <div className="flex h-dvh w-full max-w-full overflow-hidden bg-surface text-on-surface">
      <aside
        className={`flex shrink-0 flex-col border-r-2 border-primary bg-primary text-white transition-[width] duration-200 ease-out ${sidebarW}`}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-white/15 px-2 sm:px-3">
          <Link
            to="/crm"
            title="Obra10+ — CRM"
            className={`flex min-w-0 items-center overflow-hidden text-white no-underline ${expanded ? 'justify-start' : 'w-full justify-center'}`}
          >
            <Obra10Logo
              onDark
              markOnly={!expanded}
              heightClass={expanded ? 'h-7 sm:h-8' : 'h-8 w-8'}
            />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Principal">
          {navItems.map((item) =>
            'disabled' in item && item.disabled ? (
              <div
                key={item.label}
                title={item.hint}
                className={`flex items-center gap-3 rounded-sm px-2 py-2.5 text-white/35 ${expanded ? '' : 'justify-center'}`}
              >
                <span className="material-symbols-outlined shrink-0 text-xl" aria-hidden>
                  {item.icon}
                </span>
                {expanded && (
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">{item.label}</span>
                )}
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 rounded-sm px-2 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 no-underline transition hover:bg-white/10 ${expanded ? '' : 'justify-center'}`}
                activeProps={{ className: 'bg-tertiary/25 text-white' }}
              >
                <span className="material-symbols-outlined shrink-0 text-xl text-tertiary" aria-hidden>
                  {item.icon}
                </span>
                {expanded && item.label}
              </Link>
            ),
          )}
        </nav>

        <div className={`border-t border-white/15 p-2 ${expanded ? '' : 'flex justify-center'}`}>
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-sm px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 no-underline transition hover:bg-white/10 hover:text-white ${expanded ? '' : 'justify-center'}`}
            title="Site público"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              language
            </span>
            {expanded && 'Site público'}
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b-2 border-primary bg-white px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex h-10 w-10 items-center justify-center border-2 border-primary bg-white text-primary transition hover:bg-surface"
              aria-expanded={expanded}
              aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {expanded ? 'menu_open' : 'menu'}
              </span>
            </button>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">CRM</p>
              <p className="truncate text-sm font-black text-primary">{activeItem.label}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {userEmail && (
              <p className="hidden max-w-[200px] truncate text-[11px] font-medium text-on-surface-variant md:block">
                {userEmail}
              </p>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 border-2 border-primary bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition hover:bg-surface"
            >
              Sair
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
