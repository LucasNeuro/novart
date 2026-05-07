/** Chaves estáveis para TanStack Query (prefixos permitem invalidação parcial). */
export const queryKeys = {
  triageLeads: ['crm', 'triage-leads'] as const,
  crmBoard: ['crm', 'board'] as const,
  portalBoard: ['portal', 'pipeline-geral'] as const,
}
