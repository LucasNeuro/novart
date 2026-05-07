export type CrmSegmentKey = 'geral' | 'imobiliaria' | 'arquitetura' | 'servicos' | 'produtos'

export type CrmSegmentDef = {
  key: CrmSegmentKey
  label: string
  route: '/crm/geral' | '/crm/imobiliaria' | '/crm/arquitetura' | '/crm/servicos' | '/crm/produtos'
}

export const CRM_SEGMENTS: CrmSegmentDef[] = [
  { key: 'geral', label: 'Geral', route: '/crm/geral' },
  { key: 'imobiliaria', label: 'Imobiliaria', route: '/crm/imobiliaria' },
  { key: 'arquitetura', label: 'Arquitetura', route: '/crm/arquitetura' },
  { key: 'servicos', label: 'Servicos', route: '/crm/servicos' },
  { key: 'produtos', label: 'Produtos', route: '/crm/produtos' },
]

const SEGMENT_ALIASES: Record<Exclude<CrmSegmentKey, 'geral'>, string[]> = {
  imobiliaria: ['imobiliaria', 'imobiliário', 'real estate'],
  arquitetura: ['arquitetura', 'arquitetônico', 'projeto'],
  servicos: ['servicos', 'serviços', 'service'],
  produtos: ['produtos', 'produto', 'item'],
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function leadBelongsToSegment(segment: CrmSegmentKey, rawSegment: string | null): boolean {
  if (segment === 'geral') return true
  if (!rawSegment) return false
  const normalized = normalize(rawSegment)
  return SEGMENT_ALIASES[segment].some((alias) => normalized.includes(normalize(alias)))
}
