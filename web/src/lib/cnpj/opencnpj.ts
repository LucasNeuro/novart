import { publicEnv } from '../env'
import { onlyDigits, type AddressForm } from '../auth/register-validation'
import { formatCepMask } from '../address/viacep'

/** Campos relevantes devolvidos por GET https://api.opencnpj.org/{cnpj} — ver https://opencnpj.org/#api */
export type OpenCnpjTelefone = {
  ddd?: string
  numero?: string
  is_fax?: boolean
}

export type OpenCnpjSocio = {
  nome_socio?: string
  cnpj_cpf_socio?: string
  qualificacao_socio?: string
  /** … outros campos da API */
}

export type OpenCnpjCompany = {
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  situacao_cadastral?: string
  email?: string
  telefones?: OpenCnpjTelefone[]
  tipo_logradouro?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  uf?: string
  municipio?: string
  QSA?: OpenCnpjSocio[]
  [key: string]: unknown
}

export type OpenCnpjLookupResult =
  | { ok: true; data: OpenCnpjCompany }
  | { ok: false; message: string }

function formatPhoneFromApi(t: OpenCnpjTelefone): string {
  const ddd = (t.ddd ?? '').replace(/\D/g, '')
  const num = (t.numero ?? '').replace(/\D/g, '')
  if (!ddd || !num) return ''
  if (num.length === 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`
  if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
  return `(${ddd}) ${num}`
}

function formatMunicipio(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return ''
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const take = (current: string, incoming: string) =>
  current.trim() ? current : incoming.trim()

/**
 * Anexa metadados mínimos à resposta da API para auditoria (JSONB no Supabase).
 */
export function wrapOpenCnpjPayloadForStorage(data: OpenCnpjCompany): Record<string, unknown> {
  return {
    ...(data as Record<string, unknown>),
    _obra10_meta: {
      consultado_em: new Date().toISOString(),
      api_base: publicEnv.opencnpjApiBase,
      doc: 'https://opencnpj.org/#api',
    },
  }
}

/**
 * Preenche apenas campos vazios do formulário de cadastro a partir da resposta OpenCNPJ.
 */
export function mergeOpenCnpjIntoCadastroFields(
  data: OpenCnpjCompany,
  prev: {
    companyName: string
    email: string
    phone: string
    fullName: string
    address: AddressForm
  },
) {
  const fantasia = (data.nome_fantasia ?? '').trim()
  const razao = (data.razao_social ?? '').trim()
  const displayEmpresa = fantasia || razao

  const streetParts = [data.tipo_logradouro, data.logradouro].filter(Boolean).join(' ').trim()
  const cep8 = onlyDigits(data.cep ?? '').slice(0, 8)
  const emailApi = (data.email ?? '').trim().toLowerCase()
  const phoneApi =
    data.telefones && data.telefones.length > 0 ? formatPhoneFromApi(data.telefones[0]!) : ''
  const socio0 = data.QSA?.[0]?.nome_socio?.trim() ?? ''

  return {
    companyName: take(prev.companyName, displayEmpresa),
    email: take(prev.email, emailApi),
    phone: take(prev.phone, phoneApi),
    fullName: take(prev.fullName, socio0),
    address: {
      ...prev.address,
      street: take(prev.address.street, streetParts),
      number: take(prev.address.number, (data.numero ?? '').trim()),
      complement: take(prev.address.complement, (data.complemento ?? '').trim()),
      district: take(prev.address.district, (data.bairro ?? '').trim()),
      city: take(prev.address.city, formatMunicipio(data.municipio ?? '')),
      state: take(
        prev.address.state,
        (data.uf ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
      ),
      postalCode: cep8.length === 8 ? formatCepMask(cep8) : prev.address.postalCode,
      country: prev.address.country?.trim() ? prev.address.country : 'Brasil',
    } satisfies AddressForm,
  }
}

export async function lookupOpenCnpj(cnpj14: string): Promise<OpenCnpjLookupResult> {
  const digits = onlyDigits(cnpj14)
  if (digits.length !== 14) {
    return { ok: false, message: 'Indique o CNPJ completo (14 dígitos) antes de buscar.' }
  }

  const base = publicEnv.opencnpjApiBase
  const url = `${base}/${digits}`

  try {
    const res = await fetch(url)
    if (res.status === 404) {
      return { ok: false, message: 'CNPJ não encontrado na base OpenCNPJ.' }
    }
    if (!res.ok) {
      return { ok: false, message: `Consulta OpenCNPJ falhou (HTTP ${res.status}). Tente mais tarde.` }
    }

    const json: unknown = await res.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return { ok: false, message: 'Resposta inválida da API OpenCNPJ.' }
    }

    const obj = json as OpenCnpjCompany & { message?: string }
    const rawErr = (obj as Record<string, unknown>).erro
    if (
      rawErr === true ||
      (typeof rawErr === 'string' && rawErr.toLowerCase() === 'true') ||
      (typeof obj.message === 'string' && obj.message.toLowerCase().includes('not found'))
    ) {
      return { ok: false, message: 'CNPJ não encontrado na base OpenCNPJ.' }
    }

    return { ok: true, data: obj as OpenCnpjCompany }
  } catch {
    return {
      ok: false,
      message: 'Não foi possível contactar a API OpenCNPJ. Verifique a rede ou tente mais tarde.',
    }
  }
}
