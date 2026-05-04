/** Validação de cadastro — sem dependências externas. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RegisterFieldErrors = Partial<
  Record<
    | 'email'
    | 'fullName'
    | 'cpf'
    | 'phone'
    | 'password'
    | 'confirmPassword'
    | 'street'
    | 'number'
    | 'district'
    | 'city'
    | 'state'
    | 'postalCode'
    | 'country',
    string
  >
>

export type AddressForm = {
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  postalCode: string
  country: string
}

/** Apenas dígitos */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** CPF brasileiro: 11 dígitos + dígitos verificadores. */
export function isValidCpf(cpfRaw: string): boolean {
  const cpf = onlyDigits(cpfRaw)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let d1 = 0
  for (let i = 0; i < 9; i++) d1 += parseInt(cpf[i], 10) * (10 - i)
  d1 = (d1 * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== parseInt(cpf[9], 10)) return false

  let d2 = 0
  for (let i = 0; i < 10; i++) d2 += parseInt(cpf[i], 10) * (11 - i)
  d2 = (d2 * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === parseInt(cpf[10], 10)
}

/** Telefone BR: 10 ou 11 dígitos (com DDD). */
export function isValidBrPhone(phoneRaw: string): boolean {
  const p = onlyDigits(phoneRaw)
  return p.length >= 10 && p.length <= 11
}

/** Senha: mín. 8, maiúscula, minúscula, dígito e carácter especial. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Mínimo 8 caracteres.'
  if (password.length > 128) return 'Palavra-passe demasiado longa.'
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um algarismo.'
  if (!/[^a-zA-Z0-9\s]/.test(password)) return 'Inclua pelo menos um símbolo (ex.: @ # ! ?).'
  return null
}

export const PASSWORD_RULES_HINT =
  'Mínimo 8 caracteres, com maiúscula, minúscula, algarismo e um símbolo (ex.: @ # ! ?).'

export function validatePersonalStep(input: {
  email: string
  fullName: string
  cpf: string
  phone: string
}): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {}
  const email = input.email.trim().toLowerCase()
  if (!email) errors.email = 'Indique o e-mail.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Formato de e-mail inválido.'

  const fullName = input.fullName.trim()
  if (fullName.length < 2) errors.fullName = 'Nome completo: pelo menos 2 caracteres.'
  else if (fullName.length > 120) errors.fullName = 'Nome demasiado longo.'

  if (!isValidCpf(input.cpf)) errors.cpf = 'CPF inválido. Use 11 dígitos válidos.'

  if (!isValidBrPhone(input.phone)) errors.phone = 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).'

  return errors
}

export function validateAddressStep(a: AddressForm): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {}
  const street = a.street.trim()
  const number = a.number.trim()
  const district = a.district.trim()
  const city = a.city.trim()
  const state = a.state.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
  const postal = onlyDigits(a.postalCode)

  if (street.length < 2) errors.street = 'Indique a rua / logradouro.'
  if (!number) errors.number = 'Indique o número.'
  if (district.length < 2) errors.district = 'Indique o bairro.'
  if (city.length < 2) errors.city = 'Indique a cidade.'
  if (state.length !== 2) errors.state = 'UF com 2 letras (ex.: SP).'
  if (postal.length !== 8) errors.postalCode = 'CEP: 8 dígitos.'

  return errors
}

export function validateCredentialsStep(password: string, confirmPassword: string): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {}
  const pwErr = validatePasswordStrength(password)
  if (pwErr) errors.password = pwErr
  if (password !== confirmPassword) errors.confirmPassword = 'As palavras-passe não coincidem.'
  return errors
}

/** Último passo: valida tudo antes de submeter. */
export function validateFullRegistration(
  personal: { email: string; fullName: string; cpf: string; phone: string },
  address: AddressForm,
  password: string,
  confirmPassword: string,
): RegisterFieldErrors {
  return {
    ...validatePersonalStep(personal),
    ...validateAddressStep(address),
    ...validateCredentialsStep(password, confirmPassword),
  }
}

export function addressToJson(a: AddressForm): Record<string, string> {
  return {
    street: a.street.trim(),
    number: a.number.trim(),
    complement: a.complement.trim(),
    district: a.district.trim(),
    city: a.city.trim(),
    state: a.state.trim().toUpperCase().slice(0, 2),
    postal_code: onlyDigits(a.postalCode),
    country: (a.country.trim() || 'Brasil').slice(0, 80),
  }
}

export function validateProfileName(fullName: string): string | null {
  const t = fullName.trim()
  if (t.length < 2) return 'Nome completo: pelo menos 2 caracteres.'
  if (t.length > 120) return 'Nome demasiado longo.'
  return null
}
