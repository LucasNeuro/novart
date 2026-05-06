import { onlyDigits } from '../auth/register-validation'

export type ViaCepSuccess = {
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
}

export type ViaCepLookupResult =
  | { ok: true; data: ViaCepSuccess }
  | { ok: false; message: string }

/** CEP exatamente 8 dígitos (sem hífen). */
export function cepDigits8(raw: string): string {
  return onlyDigits(raw).slice(0, 8)
}

export function formatCepMask(raw: string): string {
  const d = cepDigits8(raw)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export async function lookupViaCep(cep8: string): Promise<ViaCepLookupResult> {
  if (cep8.length !== 8) {
    return { ok: false, message: 'Indique um CEP com 8 dígitos antes de buscar.' }
  }

  const url = `https://viacep.com.br/ws/${cep8}/json/`

  try {
    const res = await fetch(url)
    if (res.status === 400) {
      return {
        ok: false,
        message: 'Formato de CEP inválido. Verifique os 8 dígitos.',
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        message: 'Não foi possível consultar o CEP. Tente novamente em instantes.',
      }
    }
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, message: 'Resposta inválida do serviço de CEP. Tente de novo.' }
    }
    if (!body || typeof body !== 'object') {
      return { ok: false, message: 'Resposta inválida do serviço de CEP. Tente de novo.' }
    }
    const o = body as Record<string, unknown>
    if (o.erro === true) {
      return { ok: false, message: 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.' }
    }
    const logradouro = typeof o.logradouro === 'string' ? o.logradouro : ''
    const complemento = typeof o.complemento === 'string' ? o.complemento : ''
    const bairro = typeof o.bairro === 'string' ? o.bairro : ''
    const localidade = typeof o.localidade === 'string' ? o.localidade : ''
    const uf = typeof o.uf === 'string' ? o.uf : ''
    return {
      ok: true,
      data: { logradouro, complemento, bairro, localidade, uf },
    }
  } catch {
    return {
      ok: false,
      message: 'Erro de rede ao consultar o CEP. Verifique a sua ligação e tente outra vez.',
    }
  }
}
