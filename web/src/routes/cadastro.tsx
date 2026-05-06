import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '../lib/supabase/client'
import { isSupabaseConfigured, publicEnv } from '../lib/env'
import Obra10Logo from '../components/Obra10Logo'
import {
  addressToJson,
  PASSWORD_RULES_HINT,
  onlyDigits,
  type AddressForm,
  validateAddressStep,
  validateCamposAdicionaisStep,
  validateCredentialsStep,
  validateEmpresaStep,
  validateFullRegistration,
  validatePasswordStrength,
} from '../lib/auth/register-validation'
import { resolvePostLoginNavigation } from '../lib/auth/post-login'
import { cepDigits8, formatCepMask, lookupViaCep, type ViaCepSuccess } from '../lib/address/viacep'
import {
  lookupOpenCnpj,
  mergeOpenCnpjIntoCadastroFields,
  wrapOpenCnpjPayloadForStorage,
} from '../lib/cnpj/opencnpj'

export const Route = createFileRoute('/cadastro')({
  component: CadastroPage,
})

const PENDING_REG_KEY = 'obra10_pending_registration_v1'

type PendingRegistration = {
  email?: string
  fullName: string
  cpf: string
  phone: string
  companyCnpj?: string
  companyName?: string
  serviceScope?: string
  opencnpjPayload?: Record<string, unknown> | null
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

/** Máscara 00.000.000/0000-00 */
function formatCnpjMask(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  const parts: string[] = []
  if (d.length > 0) parts.push(d.slice(0, Math.min(2, d.length)))
  if (d.length > 2) parts.push(d.slice(2, Math.min(5, d.length)))
  if (d.length > 5) parts.push(d.slice(5, Math.min(8, d.length)))
  if (d.length > 8) parts.push(d.slice(8, Math.min(12, d.length)))
  if (d.length > 12) parts.push(d.slice(12, 14))
  if (parts.length <= 1) return parts[0] ?? ''
  let out = parts[0]
  out += '.' + parts[1]
  if (parts[2]) out += '.' + parts[2]
  if (parts[3]) out += '/' + parts[3]
  if (parts[4]) out += '-' + parts[4]
  return out
}

function mergeViaCepIntoAddress(prev: AddressForm, cep8: string, data: ViaCepSuccess): AddressForm {
  const preferIncoming = (current: string, incoming: string) => {
    const inc = incoming.trim()
    return inc.length > 0 ? inc : current
  }
  const uf = data.uf.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
  return {
    ...prev,
    postalCode: formatCepMask(cep8),
    // Quando o CEP muda, priorizamos o retorno do ViaCEP para os campos de endereço.
    street: preferIncoming(prev.street, data.logradouro),
    complement: preferIncoming(prev.complement, data.complemento),
    district: preferIncoming(prev.district, data.bairro),
    city: preferIncoming(prev.city, data.localidade),
    state: preferIncoming(prev.state, uf),
  }
}

/** Evita nomes de API na mensagem mostrada ao utilizador (textos vêm do cliente HTTP). */
function formatCnpjLookupErrorForUser(raw: string): string {
  const m = raw
    .replace(/\bConsulta\s+OpenCNPJ\s+falhou\b/gi, 'A consulta falhou')
    .replace(/\bna\s+base\s+OpenCNPJ\b/gi, '')
    .replace(/\ba\s+API\s+OpenCNPJ\b/gi, 'o serviço')
    .replace(/\bda\s+API\s+OpenCNPJ\b/gi, 'da consulta')
    .replace(/\bAPI\s+OpenCNPJ\b/gi, 'serviço')
    .replace(/\bOpenCNPJ\b/gi, '')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
  const collapsed = m.replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
  return collapsed.length > 0 ? collapsed : 'Não foi possível consultar o CNPJ. Tente mais tarde.'
}

function friendlyRpcMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('cpf_invalid')) return 'CPF inválido. Confira os dígitos.'
  if (m.includes('phone_invalid')) return 'Telefone inválido.'
  if (m.includes('address_incomplete'))
    return 'Endereço incompleto. Preencha todos os campos obrigatórios (incluindo CEP com 8 dígitos).'
  if (m.includes('full_name')) return 'Nome completo demasiado curto.'
  if (m.includes('duplicate') || m.includes('unique')) return 'Dados já registados (e-mail ou CPF).'
  return message
}

async function mergeCadastroExtras(
  supabase: SupabaseClient,
  extras: {
    companyCnpj: string
    companyName: string
    serviceScope: string
    opencnpjPayload: Record<string, unknown> | null
  },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { data: row } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('auth_subject', user.id)
    .maybeSingle()
  const meta =
    row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {}
  meta.cadastro_empresa = {
    cnpj: onlyDigits(extras.companyCnpj),
    razao_social: extras.companyName.trim(),
  }
  if (extras.serviceScope.trim()) meta.cadastro_atuacao = extras.serviceScope.trim()

  const patch: Record<string, unknown> = { metadata: meta }
  if (extras.opencnpjPayload && Object.keys(extras.opencnpjPayload).length > 0) {
    patch.opencnpj_payload = extras.opencnpjPayload
  }

  await supabase.from('profiles').update(patch).eq('auth_subject', user.id)
}

const TAB_LABELS_FULL = [
  'Empresa',
  'Endereço',
  'Acesso',
  'Atuação',
  'Adicionais',
] as const

const TAB_LABELS_COMPLETE = ['Empresa', 'Endereço', 'Atuação', 'Adicionais'] as const

const SECTION_TITLE_FULL = [
  'Empresa',
  'Endereço',
  'Acesso',
  'Atuação e serviços (obra / decoração)',
  'Campos adicionais',
] as const

const SECTION_TITLE_COMPLETE = [
  'Empresa',
  'Endereço',
  'Atuação e serviços (obra / decoração)',
  'Campos adicionais',
] as const

const cadastroInputClass =
  'mt-2 min-h-11 w-full rounded-none border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none ring-0 transition placeholder:text-neutral-400 focus:border-neutral-900 disabled:opacity-60 read-only:bg-neutral-50'

const cadastroLabelClass =
  'text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800'

function CadastroPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const [mode, setMode] = useState<'full' | 'complete'>('full')
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [serviceScope, setServiceScope] = useState('')
  const [address, setAddress] = useState<AddressForm>(emptyAddress)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [cepLookupError, setCepLookupError] = useState<string | null>(null)
  const [cepLookupLoading, setCepLookupLoading] = useState(false)
  const [opencnpjPayload, setOpencnpjPayload] = useState<Record<string, unknown> | null>(null)
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null)
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false)
  const configured = isSupabaseConfigured()

  const totalSteps = mode === 'full' ? 5 : 4
  const lastStepIndex = totalSteps - 1

  const tabLabels = mode === 'full' ? TAB_LABELS_FULL : TAB_LABELS_COMPLETE
  const sectionTitles = mode === 'full' ? SECTION_TITLE_FULL : SECTION_TITLE_COMPLETE

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
            if (typeof p.companyCnpj === 'string') setCompanyCnpj(p.companyCnpj)
            if (typeof p.companyName === 'string') setCompanyName(p.companyName)
            if (typeof p.serviceScope === 'string') setServiceScope(p.serviceScope)
            if (p.opencnpjPayload && typeof p.opencnpjPayload === 'object')
              setOpencnpjPayload(p.opencnpjPayload as Record<string, unknown>)
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

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('cadastro-scroll-scope')
    body.classList.add('cadastro-scroll-scope')
    return () => {
      html.classList.remove('cadastro-scroll-scope')
      body.classList.remove('cadastro-scroll-scope')
    }
  }, [])

  const persistPendingRegistration = useCallback(() => {
    const payload: PendingRegistration = {
      email: email.trim().toLowerCase(),
      fullName,
      cpf,
      phone,
      companyCnpj,
      companyName,
      serviceScope,
      opencnpjPayload,
      address,
    }
    try {
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [email, fullName, cpf, phone, companyCnpj, companyName, serviceScope, opencnpjPayload, address])

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
      { email, phone, companyName, cnpj: companyCnpj },
      { fullName, cpf },
      address,
      password,
      confirmPassword,
    )
    if (Object.keys(v).length > 0) {
      setFieldErrors(v as Record<string, string>)
      if (v.email || v.phone || v.companyName || v.cnpj) setStep(0)
      else if (v.street || v.number || v.district || v.city || v.state || v.postalCode) setStep(1)
      else if (v.password || v.confirmPassword) setStep(2)
      else if (v.fullName || v.cpf) setStep(4)
      return
    }
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = publicEnv.appOrigin.trim().replace(/\/+$/, '')
      if (!origin) {
        setError(
          'Defina VITE_APP_ORIGIN (URL pública da app) para o link de confirmação por e-mail. Ex.: https://app.seudominio.com',
        )
        return
      }
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${origin}/login`,
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
      await mergeCadastroExtras(supabase, {
        companyCnpj,
        companyName,
        serviceScope,
        opencnpjPayload,
      })
      await finishAndNavigate()
    } finally {
      setLoading(false)
    }
  }, [
    email,
    fullName,
    cpf,
    phone,
    companyCnpj,
    companyName,
    serviceScope,
    opencnpjPayload,
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
      ...validateEmpresaStep({ email, phone, companyName, cnpj: companyCnpj }),
      ...validateAddressStep(address),
      ...validateCamposAdicionaisStep({ fullName, cpf }),
    }
    if (Object.keys(v).length > 0) {
      setFieldErrors(v as Record<string, string>)
      if (v.email || v.phone || v.companyName || v.cnpj) setStep(0)
      else if (v.street || v.number || v.district || v.city || v.state || v.postalCode) setStep(1)
      else if (v.fullName || v.cpf) setStep(3)
      return
    }
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: finErr } = await callFinalize()
      if (finErr) {
        setError(friendlyRpcMessage(finErr.message))
        return
      }
      await mergeCadastroExtras(supabase, {
        companyCnpj,
        companyName,
        serviceScope,
        opencnpjPayload,
      })
      await finishAndNavigate()
    } finally {
      setLoading(false)
    }
  }, [
    email,
    fullName,
    cpf,
    phone,
    companyCnpj,
    companyName,
    serviceScope,
    opencnpjPayload,
    address,
    callFinalize,
    finishAndNavigate,
  ])

  const runCepLookup = useCallback(
    async (opts: { fromBlur: boolean }) => {
      const d = cepDigits8(address.postalCode)
      if (d.length !== 8) {
        if (!opts.fromBlur) {
          setCepLookupError('Digite o CEP completo (8 dígitos) para buscar.')
        }
        return
      }
      setCepLookupError(null)
      setCepLookupLoading(true)
      try {
        const result = await lookupViaCep(d)
        if (!result.ok) {
          setCepLookupError(result.message)
          return
        }
        setAddress((prev) => mergeViaCepIntoAddress(prev, d, result.data))
      } finally {
        setCepLookupLoading(false)
      }
    },
    [address.postalCode],
  )

  const onCepBlur = useCallback(() => {
    const d = cepDigits8(address.postalCode)
    if (d.length !== 8) return
    void runCepLookup({ fromBlur: true })
  }, [address.postalCode, runCepLookup])

  const runOpenCnpjLookup = useCallback(async () => {
    const d = onlyDigits(companyCnpj)
    if (d.length !== 14) return
    setCnpjLookupError(null)
    setCnpjLookupLoading(true)
    try {
      const result = await lookupOpenCnpj(d)
      if (!result.ok) {
        setCnpjLookupError(formatCnpjLookupErrorForUser(result.message))
        return
      }
      const wrapped = wrapOpenCnpjPayloadForStorage(result.data)
      setOpencnpjPayload(wrapped)
      const m = mergeOpenCnpjIntoCadastroFields(result.data, {
        companyName,
        email,
        phone,
        fullName,
        address,
      })
      setCompanyName(m.companyName)
      setEmail(m.email)
      setPhone(m.phone)
      setFullName(m.fullName)
      setAddress(m.address)
    } finally {
      setCnpjLookupLoading(false)
    }
  }, [companyCnpj, companyName, email, phone, fullName, address])

  const onCnpjBlur = useCallback(() => {
    const d = onlyDigits(companyCnpj)
    if (d.length !== 14) return
    void runOpenCnpjLookup()
  }, [companyCnpj, runOpenCnpjLookup])

  const goNext = useCallback(() => {
    setError(null)
    setFieldErrors({})
    if (mode === 'full') {
      if (step === 0) {
        const v = validateEmpresaStep({ email, phone, companyName, cnpj: companyCnpj })
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
        setStep(2)
        return
      }
      if (step === 2) {
        const v = validateCredentialsStep(password, confirmPassword)
        if (Object.keys(v).length > 0) {
          setFieldErrors(v as Record<string, string>)
          return
        }
        setStep(3)
        return
      }
      if (step === 3) {
        setStep(4)
        return
      }
      return
    }
    if (step === 0) {
      const v = validateEmpresaStep({ email, phone, companyName, cnpj: companyCnpj })
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
      setStep(2)
      return
    }
    if (step === 2) {
      setStep(3)
    }
  }, [
    mode,
    step,
    email,
    phone,
    companyName,
    companyCnpj,
    address,
    password,
    confirmPassword,
  ])

  const goBack = useCallback(() => {
    setFieldErrors({})
    setError(null)
    setCepLookupError(null)
    setCnpjLookupError(null)
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

  const showForm = configured && !(mode === 'full' && awaitingEmailConfirm)

  const sectionTitle = sectionTitles[step] ?? ''

  const primaryCtaLabel =
    loading
      ? 'A processar…'
      : mode === 'full' && step === lastStepIndex
        ? 'Registar'
        : mode === 'complete' && step === lastStepIndex
          ? 'Concluir cadastro'
          : 'Continuar'

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100">
      <header className="cadastro-auth-header fixed top-0 left-0 right-0 z-50 shrink-0 px-4 py-4 shadow-md sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/95 no-underline hover:text-tertiary"
          >
            <span className="material-symbols-outlined text-lg text-tertiary" aria-hidden>
              arrow_back
            </span>
            Voltar ao site
          </Link>
          <Obra10Logo onDark heightClass="h-8" />
          <span className="hidden w-[5.5rem] sm:block" aria-hidden />
        </div>
      </header>

      <main className="flex w-full flex-1 justify-center px-4 pb-10 pt-[5.25rem] sm:px-8 sm:pb-12 sm:pt-[5.5rem]">
        <div className="w-full max-w-4xl py-4 sm:py-6">
          <div className="border border-neutral-300 bg-white shadow-lg">
            <div className="px-5 py-6 sm:px-10 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">Cadastro</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
            {mode === 'complete' ? 'Complete o seu perfil' : 'Criar conta'}
          </h1>

          {!configured && (
            <p className="mt-4 border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
              Configure <code className="text-[11px]">VITE_SUPABASE_URL</code> e{' '}
              <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> em{' '}
              <code className="text-[11px]">.env.local</code>.
            </p>
          )}

          {error && (
            <p className="mt-4 break-words border border-red-200 bg-red-50/90 p-3 text-xs text-red-900">
              {error}
            </p>
          )}

          {mode === 'full' && awaitingEmailConfirm && pendingEmail ? (
            <div className="mt-8 space-y-4 border border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-900">
              <p className="font-bold">Confirme o seu e-mail</p>
              <p className="text-xs leading-relaxed text-neutral-600">
                Enviamos um link para <strong>{pendingEmail}</strong>. Abra a mensagem e confirme antes
                de usar <strong>Entrar</strong>.
              </p>
              <p className="text-xs leading-relaxed text-neutral-600">
                Os dados deste formulário ficaram guardados neste navegador para concluir o perfil após
                confirmar o e-mail.
              </p>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-none border-2 border-primary bg-tertiary px-5 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline"
              >
                Ir para Entrar
              </Link>
            </div>
          ) : null}

          {showForm && (mode === 'complete' || (mode === 'full' && !awaitingEmailConfirm)) ? (
            <>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Passo {step + 1} de {totalSteps}
              </p>

              <div
                className="mt-3 flex flex-wrap border border-neutral-300 sm:flex-nowrap"
                role="tablist"
                aria-label="Etapas do cadastro"
              >
                {tabLabels.map((label, i) => (
                  <div
                    key={label}
                    role="tab"
                    aria-selected={i === step}
                    className={`min-w-[20%] flex-1 border-b border-neutral-300 px-1 py-2.5 text-center text-[8px] font-bold uppercase leading-tight sm:border-b-0 sm:border-r sm:px-1.5 sm:py-3 sm:text-[9px] lg:text-[10px] ${
                      i === tabLabels.length - 1 ? 'sm:border-r-0' : ''
                    } ${
                      i === step
                        ? 'bg-neutral-900 text-white'
                        : i < step
                          ? 'bg-white text-neutral-600'
                          : 'bg-white text-neutral-800'
                    } `}
                  >
                    <span className="tabular-nums">{i + 1}</span> {label}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {showForm ? (
            <form
              className="mt-8 space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                if (step === lastStepIndex) {
                  if (mode === 'full') void submitFull()
                  else void submitComplete()
                } else goNext()
              }}
            >
              <h2 className="border-b border-neutral-200 pb-3 text-xl font-black text-neutral-950">
                {sectionTitle}
              </h2>

              {mode === 'full' && step === 0 || mode === 'complete' && step === 0 ? (
                <>
                  <label className="block">
                    <span className={cadastroLabelClass}>
                      CNPJ <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={companyCnpj}
                      onChange={(ev) => {
                        setCnpjLookupError(null)
                        setOpencnpjPayload(null)
                        setCompanyCnpj(formatCnpjMask(ev.target.value))
                      }}
                      onBlur={() => void onCnpjBlur()}
                      disabled={!configured || loading || cnpjLookupLoading}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      autoComplete="off"
                      className={cadastroInputClass + ' font-semibold tracking-wide'}
                    />
                    {fieldErrors.cnpj ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.cnpj}</span>
                    ) : null}
                    {cnpjLookupError ? (
                      <span className="mt-1 block text-xs text-red-800">{cnpjLookupError}</span>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className={cadastroLabelClass}>
                      Nome da empresa <span className="text-red-600">*</span>
                    </span>
                    <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-neutral-500">
                      Razão social ou nome fantasia
                    </span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(ev) => setCompanyName(ev.target.value)}
                      disabled={!configured || loading}
                      autoComplete="organization"
                      className={cadastroInputClass}
                    />
                    {fieldErrors.companyName ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.companyName}</span>
                    ) : null}
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={cadastroLabelClass}>
                        E-mail comercial <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        disabled={!configured || loading || mode === 'complete'}
                        readOnly={mode === 'complete'}
                        autoComplete="email"
                        className={cadastroInputClass}
                      />
                      {fieldErrors.email ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.email}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className={cadastroLabelClass}>
                        Telefone / WhatsApp <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(ev) => setPhone(ev.target.value)}
                        disabled={!configured || loading}
                        autoComplete="tel"
                        placeholder="(11) 99999-0000"
                        className={cadastroInputClass}
                      />
                      {fieldErrors.phone ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.phone}</span>
                      ) : null}
                    </label>
                  </div>
                </>
              ) : null}

              {mode === 'full' && step === 1 || mode === 'complete' && step === 1 ? (
                <>
                  <label className="block">
                    <span className={cadastroLabelClass}>CEP</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={address.postalCode}
                      onChange={(ev) => {
                        setCepLookupError(null)
                        setAddress((a) => ({
                          ...a,
                          postalCode: formatCepMask(ev.target.value),
                        }))
                      }}
                      onBlur={() => void onCepBlur()}
                      disabled={!configured || loading || cepLookupLoading}
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      maxLength={9}
                      className={cadastroInputClass + ' font-semibold tracking-wide'}
                    />
                    {fieldErrors.postalCode ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.postalCode}</span>
                    ) : null}
                    {cepLookupError ? (
                      <span className="mt-1 block text-xs text-red-800">{cepLookupError}</span>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className={cadastroLabelClass}>Rua / logradouro</span>
                    <input
                      type="text"
                      value={address.street}
                      onChange={(ev) => setAddress((a) => ({ ...a, street: ev.target.value }))}
                      disabled={!configured || loading}
                      autoComplete="street-address"
                      className={cadastroInputClass}
                    />
                    {fieldErrors.street ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.street}</span>
                    ) : null}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={cadastroLabelClass}>Número</span>
                      <input
                        type="text"
                        value={address.number}
                        onChange={(ev) => setAddress((a) => ({ ...a, number: ev.target.value }))}
                        disabled={!configured || loading}
                        className={cadastroInputClass}
                      />
                      {fieldErrors.number ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.number}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className={cadastroLabelClass}>Complemento</span>
                      <input
                        type="text"
                        value={address.complement}
                        onChange={(ev) => setAddress((a) => ({ ...a, complement: ev.target.value }))}
                        disabled={!configured || loading}
                        className={cadastroInputClass}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className={cadastroLabelClass}>Bairro</span>
                    <input
                      type="text"
                      value={address.district}
                      onChange={(ev) => setAddress((a) => ({ ...a, district: ev.target.value }))}
                      disabled={!configured || loading}
                      className={cadastroInputClass}
                    />
                    {fieldErrors.district ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.district}</span>
                    ) : null}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={cadastroLabelClass}>Cidade</span>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(ev) => setAddress((a) => ({ ...a, city: ev.target.value }))}
                        disabled={!configured || loading}
                        autoComplete="address-level2"
                        className={cadastroInputClass}
                      />
                      {fieldErrors.city ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.city}</span>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className={cadastroLabelClass}>UF</span>
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
                        className={cadastroInputClass}
                      />
                      {fieldErrors.state ? (
                        <span className="mt-1 block text-xs text-red-800">{fieldErrors.state}</span>
                      ) : null}
                    </label>
                  </div>
                  <label className="block">
                    <span className={cadastroLabelClass}>País</span>
                    <input
                      type="text"
                      value={address.country}
                      onChange={(ev) => setAddress((a) => ({ ...a, country: ev.target.value }))}
                      disabled={!configured || loading}
                      autoComplete="country-name"
                      className={cadastroInputClass}
                    />
                  </label>
                </>
              ) : null}

              {mode === 'full' && step === 2 ? (
                <>
                  <p className={cadastroLabelClass + ' normal-case'}>Requisitos da palavra-passe</p>
                  <p className="text-xs text-neutral-600">{PASSWORD_RULES_HINT}</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {pwHints.map((h) => (
                      <li
                        key={h.label}
                        className={h.ok ? 'text-green-800' : 'text-neutral-500'}
                      >
                        {h.ok ? '✓ ' : '○ '}
                        {h.label}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-4 block">
                    <span className={cadastroLabelClass}>Palavra-passe</span>
                    <div className="relative mt-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        disabled={!configured || loading}
                        autoComplete="new-password"
                        className="min-h-11 w-full rounded-none border border-neutral-300 bg-white py-2.5 pl-3 pr-12 text-sm outline-none ring-0 focus:border-neutral-900 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-0 top-0 flex min-h-11 w-12 items-center justify-center text-neutral-600"
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
                    <span className={cadastroLabelClass}>Confirmar palavra-passe</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(ev) => setConfirmPassword(ev.target.value)}
                      disabled={!configured || loading}
                      autoComplete="new-password"
                      className={cadastroInputClass}
                    />
                    {fieldErrors.confirmPassword ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.confirmPassword}</span>
                    ) : null}
                  </label>
                </>
              ) : null}

              {mode === 'full' && step === 3 || mode === 'complete' && step === 2 ? (
                <label className="block">
                  <span className={cadastroLabelClass}>
                    Descreva a sua atuação e serviços <span className="text-neutral-400">(opcional)</span>
                  </span>
                  <textarea
                    value={serviceScope}
                    onChange={(ev) => setServiceScope(ev.target.value)}
                    disabled={!configured || loading}
                    rows={4}
                    placeholder="Ex.: obras novas, remodelações, decoração, gestão de projectos…"
                    className={cadastroInputClass + ' min-h-[120px] resize-y'}
                  />
                </label>
              ) : null}

              {mode === 'full' && step === 4 || mode === 'complete' && step === 3 ? (
                <>
                  <p className="text-xs leading-relaxed text-neutral-600">
                    O HUB regista o <strong>responsável</strong> (pessoa física) na base — estes dados
                    alimentam o <code className="text-[11px]">finalize_registration</code> (nome e CPF).
                  </p>
                  <label className="block">
                    <span className={cadastroLabelClass}>
                      Nome completo do responsável <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(ev) => setFullName(ev.target.value)}
                      disabled={!configured || loading}
                      autoComplete="name"
                      className={cadastroInputClass}
                    />
                    {fieldErrors.fullName ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.fullName}</span>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className={cadastroLabelClass}>
                      CPF (responsável) <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cpf}
                      onChange={(ev) => setCpf(ev.target.value)}
                      disabled={!configured || loading}
                      placeholder="000.000.000-00"
                      className={cadastroInputClass}
                    />
                    {fieldErrors.cpf ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldErrors.cpf}</span>
                    ) : null}
                  </label>
                </>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={!configured || loading}
                    className="min-h-11 rounded-none border border-neutral-400 bg-white px-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-900 disabled:opacity-50"
                  >
                    Voltar
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <button
                  type="submit"
                  disabled={!configured || loading}
                  className="min-h-12 w-full rounded-none bg-tertiary px-8 text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
                >
                  {primaryCtaLabel}
                </button>
              </div>
            </form>
          ) : null}

          <p className="mt-8 text-center text-xs text-neutral-600">
            Já tem conta?{' '}
            <Link to="/login" className="font-bold text-tertiary no-underline hover:underline">
              Entrar
            </Link>
          </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
