# Guia de implementação — CRM Obra10+ (TanStack Start + Tailwind + Supabase)

Documento para **alinhar engenharia** antes e durante a implementação do núcleo do CRM: espinha dorsal, **triagem pelo Administrador HUB**, configuração dinâmica (funis, etapas, formulários) e continuidade visual com o que já está documentado no repositório.

**Stack alvo:** TanStack Start, TanStack Router, Tailwind CSS v4, Supabase (PostgreSQL, Auth, RLS, Storage conforme necessidade).

**Documentos relacionados:**

| Documento | Conteúdo |
|-----------|----------|
| [spec.md](./spec.md) | Visão do produto, princípios, entidades, módulos, eventos, stack React + Supabase |
| [mkds.md](./mkds.md) | Manual de UI: tokens, componentes, rotas auth, shell, mapa de ficheiros `frontend/` |
| [layout-visual.md](./layout-visual.md) | Hierarquia de layouts, `AuthSplitLayout`, `AppShell`, tokens, guards |

---

## 1. Objetivos do primeiro marco

1. **CRM com triagem única** para o **Administrador HUB**: entrada WhatsApp (webhooks/Edge Function) e **formulários configuráveis** geram o mesmo tipo de registo na **fila de triagem**.
2. **Configurável pelo HUB Admin**: pipeline(s) de triagem, etapas (ordem, slugs), classificação mínima; **evitar estágios hardcoded** no código de aplicação.
3. **Robustez**: RLS desde o início; **eventos de domínio** (ex.: `domain_events`); auditoria de mudança de estágio e de classificação humana.
4. **Visual e auth**: reutilizar identidade e padrões em [mkds.md](./mkds.md) e [layout-visual.md](./layout-visual.md) — tokens em `index.css`, `AuthSplitLayout`, `AppShell`, guards.

**Explícito fora do primeiro marco:** portal completo de parceiro/prestador com funil próprio e gestão total (preparar modelo de dados e RLS; não fechar UX nesse passo).

---

## 2. Decisões de produto assumidas (fluxo)

- **Fluxo:** todos entram no **mesmo funil inicial** de triagem; **IA classifica** (sugestão); **HUB Admin decide** encaminhamento e classificação final operacional.
- **Personas de entrada:** cliente final (comprar, alugar, construir, projeto de arquitetura); prestador com ou sem CNPJ; empresa (arquitetura, engenharia, fornecedor de materiais/acabamentos).
- **Organizações:** a UX de onboarding de parceiros pode vir **depois**, mas o **schema** deve antecipar `organizacao_id` (ou tenant sistema/HUB explícito) para não refatorar políticas RLS no meio do projeto.

---

## 3. Ordem sugerida — backend (Supabase)

1. **Auth e perfis HUB** — tabela(s) e regras que identificam inequivocamente **Administrador HUB** (ver SPEC §4 e MKDS §9.1).
2. **Tabelas de configuração** — pipelines, etapas (ordem, slug, `is_terminal` onde aplicável); opcionalmente segmentos ou tipos de lead alinhados ao SPEC.
3. **Entidade de oportunidade na triagem** — ligada a pipeline/estágio atual; campos de **classificação** (humano + sugestão IA); **origem** (`whatsapp` | `form` | `manual`); identificadores externos para **idempotência** de webhook.
4. **`domain_events` (append-only)** — tipos mínimos: criação, mudança de estágio, classificação HUB, atualização de sugestão IA; contexto com `id_negocio` ou equivalente (SPEC §7).
5. **RLS** — políticas testáveis: HUB Admin vê fila global de triagem; utilizadores futuros restritos por organização/membro.
6. **Form builder (MVP)** — definição de formulário (JSON ou tabelas normalizadas); submissões **criam o mesmo tipo de registo** que a ingestão WhatsApp.

**Integrações:** Edge Function (ou handler servidor Start) para webhooks com **segredos**; tokens de WhatsApp/provedores **nunca** no cliente.

---

## 4. Ordem sugerida — frontend (TanStack Start)

### 4.1 Projeto e design system

- Scaffold **TanStack Start** com **Tailwind v4**; portar `@theme` e utilitários globais do CSS atual (`@import "tailwindcss"`, scrollbars, animações onde existirem).
- **Componentes próprios:** biblioteca React (Button, Input, Card, PageHeader, tabelas) **estilizada com Tailwind**, alinhada ao MKDS — evitar substituir Tailwind por folhas CSS extensas sem necessidade.

### 4.2 Autenticação e layouts (login e fluxos)

Mapear os contratos do repositório atual para rotas/layouts do Start:

| Conceito (docs atuais) | Responsabilidade no TanStack Start |
|------------------------|-------------------------------------|
| `AuthSplitLayout` variante `split` | Login e fluxos auth com coluna hero |
| Variante `header` | Cadastro público longo, convites, homologação |
| `LoginPage` | Formulário de acesso, erros, links recuperação / governação HUB |
| `Protected` | Guard: sessão Supabase; estado de carregamento fullscreen |
| `AdminOnly` | Guard: papel Administrador HUB |
| `AppShell` | Área logada: top bar, sidebar, conteúdo com scroll interno |
| `getPostLoginPath` (ou equivalente) | Redirecionar `/adm`, `/acesso/pendente-hub`, `/crm` conforme regras atuais |

**Checklist visual:** Inter; Material Symbols Outlined; cores `primary` / `tertiary` / `surface`; labels densos em maiúsculas; no split auth, **scroll só na coluna do formulário** em desktop (cf. layout-visual §4).

### 4.3 Rotas do CRM (MVP)

- **Governança / config:** sub-rotas sob `/adm` (ou agrupamento equivalente): pipelines, etapas, formulários — conforme escopo da sprint.
- **Triagem:** `/crm` ou `/triagem` — lista ou kanban da **fila única**; detalhe com **histórico de eventos**; ações: mudar estágio, gravar classificação, encaminhar (no MVP, encaminhar pode ser campo + evento até existir segundo funil operacional).

### 4.4 Relação com o frontend legado (`frontend/`)

O código atual usa **React (Vite) + React Router** (incl. `HashRouter` descrito em layout-visual). Plano de transição:

- Extrair **tokens CSS** e componentes visuais reutilizáveis para o app Start.
- Reimplementar **rotas e layouts** com **TanStack Router** (convenções do template Start).
- Manter cliente Supabase e políticas RLS; usar **server functions** ou Edge para operações com segredo.

---

## 5. Critérios de pronto do primeiro marco

- [ ] Administrador HUB autentica e acede à **fila de triagem** com isolamento correto (RLS verificada em testes manuais ou SQL).
- [ ] Criar/editar **etapas** do funil inicial **sem novo deploy** de código (apenas dados + UI admin).
- [ ] Submissão de **formulário configurável** cria registo na **mesma** fila que uma criação vinda de canal WhatsApp (mesma entidade ou view unificada).
- [ ] Mudanças relevantes geram **eventos** consultáveis no detalhe do registo.
- [ ] **Login, recuperação de senha e shell** coerentes com MKDS / layout-visual (revisão visual rápida).

---

## 6. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Builder de formulários estoura o MVP | MVP com tipos de campo limitados e JSON simples; validações avançadas em fase 2 |
| Organizações depois quebram RLS | Introduzir `organizacao_id` ou tenant sistema cedo no schema |
| Duplicação legado + Start | Decidir se dashboard de campanhas fica no legado até migração ou se o CRM nasce em app novo isolado (ADR breve) |

---

## 7. Próximos passos imediatos

**Código da app:** pasta `web/` na raiz do repositório (TanStack Start + Tailwind v4). Variáveis: `web/.env.example`. Migrações SQL: `supabase/migrations/`.

1. Scaffold TanStack Start + Tailwind v4 + cliente Supabase. *(feito em `web/`.)*
2. Portar tema CSS e componentes base (marca, auth split, shell mínimo). *(tema MKDS base + cliente Supabase; auth/shell CRM por fazer.)*
3. Implementar auth, guards e área logada vazia.
4. Migrations Supabase: ficheiro `supabase/migrations/20260504160000_crm_triagem_core.sql` (pipelines, estágios seed, `triage_leads`, `domain_events`, RLS + `is_hub_admin`). Aplicar no projeto e inserir o primeiro utilizador em `hub_admins`.
5. UI triagem + UI admin mínima de configuração.

---

## 8. Changelog do documento

| Versão | Data | Notas |
|--------|------|--------|
| 0.1 | 2026-05-04 | Versão inicial; alinhado a spec, mkds e layout-visual do repositório |

---

*Revisar após a primeira sprint de implementação e registrar decisões em ADRs quando houver fork arquitetônico (ex.: monorepo vs app único).*