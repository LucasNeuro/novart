import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured, publicEnv } from '../lib/env'
import Obra10Logo from '../components/Obra10Logo'
import {
  addressToJson,
  PASSWORD_RULES_HINT,
  onlyDigits,
  type AddressForm,
  validateAddressStep,
  validateFullRegistration,
  validatePasswordStrength,
  validatePersonalStep,
} from '../lib/auth/register-validation'
import { resolvePostLoginNavigation } from '../lib/auth/post-login'

export const Route = createFileRoute('/cadastro')({
  component: CadastroPage,
})

const IMG_PANEL =
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2000&q=80'

const PENDING_REG_KEY = 'obra10_pending_registration_v1'

type PendingRegistration = {
  email?: string
  fullName: string
  cpf: string
  phone: string
  address: AddressForm
}

const emptyAddress = (): AddressForm => ({
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Brasil',
})

function friendlyRpcMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('cpf_invalid')) return 'CPF inválido. Confira os dígitos.'
  if (m.includes('phone_invalid')) return 'Telefone inválido.'
  if (m.includes('address_incomplete')) return 'Morada incompleta. Preencha todos os campos obrigatórios.'
  if (m.includes('full_name')) return 'Nome completo demasiado curto.'
  if (m.includes('duplicate') || m.includes('unique')) return 'Dados já registados (e-mail ou CPF).'
  return message
}

function CadastroPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const [mode, setMode] = useState<'full' | 'complete'>('full')
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState<AddressForm>(emptyAddress)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const configured = isSupabaseConfigured()

  const lastStep = mode === 'complete' ? 1 : 2

  const stepLabels = useMemo(
    () =>
      mode === 'complete'
        ? (['Dados pessoais', 'Morada'] as const)
        : (['Dados pessoais', 'Morada', 'Acesso'] as const),
    [mode],
  )

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!configured) return
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_subject', user.id)
        .maybeSingle()
      if (cancelled) return
      if (!profile) {
        setMode('complete')
        setEmail(user.email ?? '')
        setStep(0)
        setAwaitingEmailConfirm(false)
        try {
          const raw = sessionStorage.getItem(PENDING_REG_KEY)
          if (raw) {
            const p = JSON.parse(raw) as PendingRegistration
            if (typeof p.fullName === 'string') setFullName(p.fullName)
            if (typeof p.cpf === 'string') setCpf(p.cpf)
            if (typeof p.phone === 'string') setPhone(p.phone)
            if (p.address && typeof p.address === 'object') {
              setAddress({ ...emptyAddress(), ...p.address })
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [configured])

  const persistPendingRegistration = useCallback(() => {
    const payload: PendingRegistration = {
      email: email.trim().toLowerCase(),
      fullName,
      cpf,
      phone,
      address,
    }
    try {
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [email, fullName, cpf, phone, address])

  const clearPendingRegistration = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_REG_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const callFinalize = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    return supabase.rpc('finalize_registration', {
      p_full_name: fullName.trim(),
      p_cpf: onlyDigits(cpf),
      p_phone: onlyDigits(phone),
      p_address: addressToJson(address),
    })
  }, [fullName, cpf, phone, address])

  const finishAndNavigate = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const nav = await resolvePostLoginNavigation(supabase, undefined)
    if (!nav.ok) {
      if (nav.signOut) await supabase.auth.signOut()
      setError(nav.message)
      return
    }
    clearPendingRegistration()
    await router.invalidate()
    await navigate({ to: nav.path })
  }, [navigate, router, clearPendingRegistration])

  const submitFull = useCallback(async () => {
    setError(null)
    setFieldErrors({})
    const v = validateFullRegistration(
      { email, fullName, cpf, phone },
      address,
      password,
      confirmPassword,
    )
    if (Object.keys(v).length > 0) {
      setFieldErrors(v as Record<string, string>)
      const addrKeys: (keyof typeof v)[] = [
        'street',
        'number',
        'district',
        'city',
        'state',
        'postalCode',
      ]
      if (v.email || v.fullName || v.cpf || v.phone) setStep(0)
      else if (addrKeys.some((k) => v[k])) setStep(1)
      else setStep(2)
      return
    }
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = publicEnv.appOrigin.trim().replace(/\/+$/, '')
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          ...(origin ? { emailRedirectTo: `${origin}/login` } : {}),
        },
      })
      if (signErr) {
        setError(signErr.message)
        return
      }

      if (!signData.session) {
        persistPendingRegistration()
        setPendingEmail(email.trim().toLowerCase())
        setAwaitingEmailConfirm(true)
        setPassword('')
        setConfirmPassword('')
        return
      }

      const { error: finErr } = await callFinalize()
      if (finErr) {
        setError(friendlyRpcMessage(finErr.message))
        return
      }
      await finishAndNavigate()
    } finally {
      setLoading(false)
    }
  }, [
    email,
    fullName,
    cpf,
    phone,
    address,
    password,
    confirmPassword,
    persistPendingRegistration,
    callFinalize,
    finishAndNavigate,
  ])

  const submitComplete = useCallback(async () => {
    setError(null)
    setFieldErrors({})
    const v = {
      ...validatePersonalStep({ email, fullName, cpf, phone }),
      ...validateAddressStep(address),
    }
    if (Object.keys(v).length > 0) {
      setFieldErrors(v as Record<string, string>)
      return
    }
    setLoading(true)
    try {
      const { error: finErr } = await callFinalize()
      if (finErr) {
        setError(friendlyRpcMessage(finErr.message))
        return
      }
      await finishAndNavigate()
    } finally {
      setLoading(false)
    }
  }, [email, fullName, cpf, phone, address, callFinalize, finishAndNavigate])

  const goNext = useCallback(() => {
    setError(null)
    setFieldErrors({})
    if (step === 0) {
      const v = validatePersonalStep({ email, fullName, cpf, phone })
      if (Object.keys(v).length > 0) {
        setFieldErrors(v as Record<string, string>)
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      const v = validateAddressStep(address)
      if (Object.keys(v).length > 0) {
        setFieldErrors(v as Record<string, string>)
        return
      }
      if (mode === 'complete') {
        void submitComplete()
        return
      }
      setStep(2)
    }
  }, [step, email, fullName, cpf, phone, address, mode, submitComplete])

  const goBack = useCallback(() => {
    setFieldErrors({})
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const pwHints = useMemo(() => {
    return [
      { ok: password.length >= 8, label: 'Pelo menos 8 caracteres' },
      { ok: /[a-z]/.test(password), label: 'Uma letra minúscula' },
      { ok: /[A-Z]/.test(password), label: 'Uma letra maiúscula' },
      { ok: /[0-9]/.test(password), label: 'Um algarismo' },
      { ok: /[^a-zA-Z0-9\s]/.test(password), label: 'Um símbolo (! @ # …)' },
    ]
  }, [password])

  const showForm =
    configured && !(mode === 'full' && awaitingEmailConfirm)

  return (
    <div className="flex min-h-dvh min-h-[100dvh] w-full flex-col overflow-x-hidden bg-white lg:flex-row">
      <aside className="login-auth-panel relative flex min-h-[min(38vh,280px)] w-full shrink-0 flex-col justify-between px-4 py-6 text-white sm:min-h-[260px] sm:px-8 sm:py-8 lg:min-h-dvh lg:w-[44%] lg:max-w-[560px] lg:px-10 lg:py-12">
        <div
          className="login-auth-photo"
          style={{ backgroundImage: `url(${IMG_PANEL})` }}
          role="img"
          aria-label="Canteiro de obras"
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
            O primeiro registo torna-se <strong className="text-tertiary">owner</strong> do HUB. Os
            seguintes pedidos ficam <strong className="text-tertiary">pendentes</strong> até
            aprovação.
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/70">
            Confirmar o e-mail só valida a conta; o acesso ao CRM para equipa segue as regras acima
            (owner aprovado ou hub_admin após aprovação do owner).
          </p>
        </div>
        <p className="relative z-10 mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 lg:mt-0">
          Uso autorizado · confidencial
        </p>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-center px-4 py-8 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="border border-outline-variant/80 bg-surface/30 px-5 py-7 shadow-lg sm:px-10 sm:py-10">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Cadastro</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-primary sm:text-2xl">
              {mode === 'complete' ? 'Complete o seu perfil' : 'Criar conta'}
            </h2>
            <p className="mt-4 text-xs font-medium leading-relaxed text-on-surface-variant">
              {mode === 'complete'
                ? 'Precisamos dos seus dados e da morada para activar o perfil no HUB.'
                : 'Cadastro em passos: dados pessoais, morada e palavra-passe. ' + PASSWORD_RULES_HINT}
            </p>

            {mode === 'complete' || (mode === 'full' && !awaitingEmailConfirm) ? (
              <div className="mt-5 flex gap-2" role="list" aria-label="Passos do cadastro">
                {stepLabels.map((label, i) => (
                  <div
                    key={label}
                    role="listitem"
                    className={`flex-1 border-2 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider ${
                      i === step
                        ? 'border-tertiary bg-tertiary/10 text-primary'
                        : i < step
                          ? 'border-primary/40 text-on-surface-variant'
                          : 'border-outline-variant/60 text-on-surface-variant/70'
                    }`}
                  >
                    {i + 1}. {label}
                  </div>
                ))}
              </div>
            ) : null}

            {!configured && (
              <p className="mt-4 border-2 border-primary/20 bg-white/80 p-3 text-xs text-primary">
                Configure <code className="text-[11px]">VITE_SUPABASE_URL</code> e{' '}
                <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> em{' '}
                <code className="text-[11px]">.env.local</code>.
              </p>
            )}

            {error && (
              <p className="mt-4 break-words rounded-sm border-2 border-red-800/30 bg-red-50/90 p-3 text-xs text-red-900">
                {error}
              </p>
            )}

            {mode === 'full' && awaitingEmailConfirm && pendingEmail ? (
              <div className="mt-8 space-y-4 rounded-sm border-2 border-primary/25 bg-white/90 p-4 text-sm text-primary">
                <p className="font-bold">Confirme o seu e-mail</p>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  Enviamos um link para <strong className="text-primary">{pendingEmail}</strong>.
                  Abra a mensagem e confirme antes de usar <strong>Entrar</strong>.
                </p>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  Guardámos os dados deste formulário neste navegador: depois de confirmar e iniciar
                  sessão, volte a esta página (ou faça login — será redireccionado) para concluir o
                  perfil automaticamente com os dados preenchidos.
                </p>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center justify-center border-2 border-primary bg-tertiary px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline"
                >
                  Ir para Entrar
                </Link>
              </div>
            ) : null}

            {showForm ? (
              <form
                className="mt-8 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (mode === 'full' && step === lastStep) void submitFull()
                  else goNext()
                }}
              >
                {step === 0 ? (
                  <>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        E-mail
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        disabled={!configured || loading || mode === 'complete'}
                        readOnly={mode === 'complete'}
                        autoComplete="email"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60 read-only:bg-black/[0.04]"
                      />
                      {fieldErrors.email ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.email}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Nome completo
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(ev) => setFullName(ev.target.value)}
                        disabled={!configured || loading}
                        autoComplete="name"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.fullName ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.fullName}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        CPF
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={cpf}
                        onChange={(ev) => setCpf(ev.target.value)}
                        disabled={!configured || loading}
                        placeholder="000.000.000-00"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.cpf ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.cpf}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Telefone (com DDD)
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(ev) => setPhone(ev.target.value)}
                        disabled={!configured || loading}
                        autoComplete="tel"
                        placeholder="(11) 99999-0000"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.phone ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.phone}</span>
                      ) : null}
                    </label>
                  </>
                ) : null}

                {step === 1 ? (
                  <>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Rua / logradouro
                      </span>
                      <input
                        type="text"
                        value={address.street}
                        onChange={(ev) => setAddress((a) => ({ ...a, street: ev.target.value }))}
                        disabled={!configured || loading}
                        autoComplete="street-address"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.street ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.street}</span>
                      ) : null}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          Número
                        </span>
                        <input
                          type="text"
                          value={address.number}
                          onChange={(ev) => setAddress((a) => ({ ...a, number: ev.target.value }))}
                          disabled={!configured || loading}
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                        {fieldErrors.number ? (
                          <span className="mt-1 block text-xs text-red-800">{fieldErrors.number}</span>
                        ) : null}
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          Complemento
                        </span>
                        <input
                          type="text"
                          value={address.complement}
                          onChange={(ev) => setAddress((a) => ({ ...a, complement: ev.target.value }))}
                          disabled={!configured || loading}
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Bairro
                      </span>
                      <input
                        type="text"
                        value={address.district}
                        onChange={(ev) => setAddress((a) => ({ ...a, district: ev.target.value }))}
                        disabled={!configured || loading}
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.district ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.district}</span>
                      ) : null}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          Cidade
                        </span>
                        <input
                          type="text"
                          value={address.city}
                          onChange={(ev) => setAddress((a) => ({ ...a, city: ev.target.value }))}
                          disabled={!configured || loading}
                          autoComplete="address-level2"
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                        {fieldErrors.city ? (
                          <span className="mt-1 block text-xs text-red-800">{fieldErrors.city}</span>
                        ) : null}
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          UF
                        </span>
                        <input
                          type="text"
                          maxLength={2}
                          value={address.state}
                          onChange={(ev) =>
                            setAddress((a) => ({
                              ...a,
                              state: ev.target.value.toUpperCase().replace(/[^a-zA-Z]/g, ''),
                            }))
                          }
                          disabled={!configured || loading}
                          autoComplete="address-level1"
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                        {fieldErrors.state ? (
                          <span className="mt-1 block text-xs text-red-800">{fieldErrors.state}</span>
                        ) : null}
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          CEP
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={address.postalCode}
                          onChange={(ev) => setAddress((a) => ({ ...a, postalCode: ev.target.value }))}
                          disabled={!configured || loading}
                          autoComplete="postal-code"
                          placeholder="00000-000"
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                        {fieldErrors.postalCode ? (
                          <span className="mt-1 block text-xs text-red-800">{fieldErrors.postalCode}</span>
                        ) : null}
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                          País
                        </span>
                        <input
                          type="text"
                          value={address.country}
                          onChange={(ev) => setAddress((a) => ({ ...a, country: ev.target.value }))}
                          disabled={!configured || loading}
                          autoComplete="country-name"
                          className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                        />
                      </label>
                    </div>
                  </>
                ) : null}

                {mode === 'full' && step === 2 ? (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                      Requisitos da palavra-passe
                    </p>
                    <p className="text-xs text-on-surface-variant">{PASSWORD_RULES_HINT}</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {pwHints.map((h) => (
                        <li
                          key={h.label}
                          className={h.ok ? 'text-green-800' : 'text-on-surface-variant/80'}
                        >
                          {h.ok ? '✓ ' : '○ '}
                          {h.label}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-4 block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Palavra-passe
                      </span>
                      <div className="relative mt-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(ev) => setPassword(ev.target.value)}
                          disabled={!configured || loading}
                          autoComplete="new-password"
                          className="min-h-11 w-full border-2 border-outline-variant bg-white py-2.5 pl-3.5 pr-12 text-sm outline-none disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-0 top-0 flex min-h-11 w-12 items-center justify-center text-on-surface-variant"
                          aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                        >
                          <span className="material-symbols-outlined">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                      {fieldErrors.password ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.password}</span>
                      ) : password.length > 0 && validatePasswordStrength(password) ? (
                        <span className="mt-1 block text-xs text-amber-900">
                          {validatePasswordStrength(password)}
                        </span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                        Confirmar palavra-passe
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(ev) => setConfirmPassword(ev.target.value)}
                        disabled={!configured || loading}
                        autoComplete="new-password"
                        className="mt-2 min-h-11 w-full border-2 border-outline-variant bg-white px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      {fieldErrors.confirmPassword ? (
                        <span className="mt-1 block text-xs text-red-800">
                          {fieldErrors.confirmPassword}
                        </span>
                      ) : null}
                    </label>
                  </>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={!configured || loading}
                      className="min-h-12 flex-1 border-2 border-outline-variant bg-white py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary disabled:opacity-50"
                    >
                      Voltar
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="min-h-12 flex-[2] border-2 border-primary bg-tertiary py-3.5 text-[10px] font-black uppercase tracking-[0.22em] text-white disabled:opacity-50"
                  >
                    {loading
                      ? 'A processar…'
                      : mode === 'full' && step === lastStep
                        ? 'Registar'
                        : mode === 'complete' && step === 1
                          ? 'Concluir cadastro'
                          : 'Seguinte'}
                  </button>
                </div>
              </form>
            ) : null}

            <p className="mt-6 text-center text-xs text-on-surface-variant">
              Já tem conta?{' '}
              <Link to="/login" className="font-bold text-tertiary no-underline hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
