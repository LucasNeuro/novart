import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase/client'
import { checkHubAdminAccess } from '../../lib/auth/hub-admin'

export const Route = createFileRoute('/crm/aprovacoes')({
  component: CrmAprovacoesPage,
})

type Row = {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

function CrmAprovacoesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('role', 'hub_admin')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })
    if (qErr) setError(qErr.message)
    else setRows((data ?? []) as Row[])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const supabase = getSupabaseBrowserClient()
      const access = await checkHubAdminAccess(supabase)
      if (cancelled) return
      if (!access.ok) {
        setForbiddenMessage('Sessão ou acesso inválido.')
        setLoading(false)
        return
      }
      if (access.role !== 'owner') {
        setForbiddenMessage('Apenas o owner pode aprovar novos administradores.')
        setLoading(false)
        return
      }
      await refresh()
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const act = useCallback(
    async (id: string, approve: boolean) => {
      setBusy(id)
      setError(null)
      const supabase = getSupabaseBrowserClient()
      const { error: rpcErr } = await supabase.rpc('approve_hub_candidate', {
        p_profile_id: id,
        p_approve: approve,
      })
      setBusy(null)
      if (rpcErr) {
        setError(rpcErr.message)
        return
      }
      await refresh()
    },
    [refresh],
  )

  if (loading) {
    return <p className="p-8 text-sm font-medium text-on-surface-variant">A carregar…</p>
  }

  if (forbiddenMessage) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p className="text-sm font-bold text-primary">{forbiddenMessage}</p>
        <button
          type="button"
          className="mt-4 border-2 border-primary px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]"
          onClick={() => void navigate({ to: '/crm' })}
        >
          Voltar ao CRM
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Equipa</p>
      <h1 className="mt-2 text-2xl font-black text-primary">Pedidos pendentes</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Aprove ou recuse contas que pediram acesso ao HUB após o primeiro owner existir.
      </p>
      {error ? (
        <p className="mt-4 border-2 border-red-200 bg-red-50 p-3 text-xs text-red-900">{error}</p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <li className="border-2 border-outline-variant bg-white p-4 text-sm text-on-surface-variant">
            Nenhum pedido pendente.
          </li>
        ) : null}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 border-2 border-primary/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-bold text-primary">{r.full_name ?? '—'}</p>
              <p className="text-xs text-on-surface-variant">{r.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === r.id}
                className="border-2 border-primary bg-tertiary px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                onClick={() => void act(r.id, true)}
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                className="border-2 border-primary bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary disabled:opacity-50"
                onClick={() => void act(r.id, false)}
              >
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
