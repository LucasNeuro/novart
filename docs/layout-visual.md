# Layout visual da plataforma Obra10+ (dashmidias)

Documento **descritivo e operacional** da camada visual do frontend: estrutura de ecrãs, hierarquia de layouts, tokens e comportamentos que definem a experiência após abrir a aplicação. Complementa [MKDS.md](./MKDS.md) (manual de UI detalhado) e [UI_APP_SHELL.md](./UI_APP_SHELL.md) (shell autenticado). **Fonte de verdade dos valores hex e classes:** `frontend/src/index.css` e os componentes citados.

---

## 1. Stack e envolvimento global

| Aspeto | Implementação |
|--------|-----------------|
| Framework | React (Vite), React Router |
| Estilos | Tailwind CSS v4 (`@import "tailwindcss"` + bloco `@theme` em `frontend/src/index.css`) |
| Tipografia | **Inter** (pesos 300–900), Google Fonts em `frontend/index.html` |
| Ícones | **Material Symbols Outlined** (opsz 24, wght 400, FILL 0), classe `.material-symbols-outlined` |
| Raiz da UI | `<body class="bg-surface text-on-surface antialiased">` — fundo e texto base do tema |
| Router | `HashRouter` em `App.jsx` — URLs efectivas usam fragmento `#/` (ex.: `/#/login`) |
| Feedback global | `UiFeedbackProvider`: toasts (canto inferior direito), modais de alerta/confirmação (`frontend/src/context/UiFeedbackContext.jsx`) |

---

## 2. Tokens visuais (resumo)

Definidos em `@theme` em `index.css`. Classes Tailwind derivadas: `bg-primary`, `text-on-surface`, `border-outline-variant`, etc.

| Token | Hex (aprox.) | Uso na plataforma |
|-------|----------------|-------------------|
| `primary` | `#0b1622` | Navy institucional: títulos fortes, bordas de destaque, hero lateral de auth, loaders fullscreen em alguns guards |
| `secondary` | `#515f74` | Cinza-azulado (uso pontual) |
| `tertiary` | `#22c55e` | Acento positivo: «10+» na marca, CTAs principais, indicador de item activo na navegação, botão de expandir gaveta lateral |
| `surface` | `#f7f9fb` | Fundo «papel» global do body |
| `surface-container` / `-high` / `-low` | Cinzas escalonados | Cabeçalhos de tabela, divisórias, fundos neutros; `-low` em áreas como login/carregamento |
| `on-surface` / `on-surface-variant` | Texto principal / secundário |
| `outline` / `outline-variant` | Bordas de inputs e separadores leves |
| **Raio** | `0` no tema | Visual **sem cantos arredondados por defeito**; excepções pontuais (`rounded-lg`, `rounded-full`) onde o código o pede |

**Tom visual:** alta densidade de informação, rótulos frequentes em **maiúsculas** com `font-black` e `tracking-widest` / `tracking-[0.2em]`, evocando relatório executivo e governança.

---

## 3. Mapa de layouts por tipo de rota

A aplicação não usa um único CSS global para todos os ecrãs; alterna entre **três famílias** principais:

1. **Auth split** — login e fluxos com coluna escura + formulário (`AuthSplitLayout`, variante `split`).
2. **Auth / público com cabeçalho** — cadastro público, convites, homologação (`AuthSplitLayout`, variante `header`).
3. **Shell autenticado** — área logada com barra superior, rail lateral + gaveta e cartão de conteúdo (`AppShell`).

Além disso existem **ecrãs minimais**: loaders fullscreen dos guards (`Protected`, `AdminOnly`) e páginas que ocupam viewport sem shell completo em casos específicos.

---

## 4. Layout partilhado de autenticação (`AuthSplitLayout`)

**Ficheiro:** `frontend/src/components/AuthSplitLayout.jsx`

### 4.1 Variante `split` (login clássico)

- **Viewport:** `100dvh`; em desktop o contentor principal usa `overflow-hidden` para o scroll **não** ser o da página inteira.
- **Grid desktop:** duas colunas — rail esquerdo fixo em largura `minmax(272px, 320px)` + área principal flexível.
- **Coluna esquerda (`aside`):**
  - Fundo `bg-primary`, texto branco.
  - Contém **HubBrandMark** (wordmark «Obra10+» com «10+» em `tertiary`), `badge` opcional, `heroTitle` / `heroSubtitle`, `buildLabel` no rodapé da coluna.
  - Em mobile: altura máxima ~44vh com scroll próprio se necessário; separação `border-b border-white/10`; em desktop `border-r` discreta.
- **Coluna direita:**
  - Fundo branco; zona interna com `overflow-y-auto` e classe `hub-table-scrollbar`.
  - Formulário centrado verticalmente em desktop (`lg:justify-center`), com paddings responsivos.
- **Marca:** não repetir «Obra10+» como título hero se for igual ao texto já mostrado pela marca (lógica `showHeroTitle`).

### 4.2 Variante `header` (cadastro e fluxos públicos longos)

- **Coluna única:** `min-h-[100dvh]`, fundo `bg-surface`.
- **Cabeçalho sticky:** `border-b border-black/15 bg-primary shadow-sm`; dentro, `max-w-6xl` centrado — marca compacta, badge opcional, build label em desktop.
- **Main:** scroll vertical com `hub-table-scrollbar`; conteúdo limitado a `max-w-4xl` para legibilidade em formulários longos.

### 4.3 Marca (`HubBrandMark`)

**Ficheiro:** `frontend/src/components/HubBrandMark.jsx`

- Modo normal: tipografia grande branca + «10+» verde.
- Modo `compact`: para barra superior e header sticky — `text-lg`–`text-xl`, truncável.

---

## 5. Shell autenticado (`AppShell`)

**Ficheiro:** `frontend/src/components/AppShell.jsx`  
**Documentação focada:** [UI_APP_SHELL.md](./UI_APP_SHELL.md)

### 5.1 Estrutura geral

- **Root:** `fixed inset-0 flex flex-col overflow-hidden` com fundo `bg-[#f1f5f9]` — a área da app ocupa sempre a viewport; o scroll fica **dentro** do `<main>` do cartão de conteúdo.
- **Barra superior (`AppShellTopBar`):**
  - Altura ~`h-14` (`3.5rem`), `z-[80]`.
  - Gradiente horizontal `from-primary via-[#1a3050] to-[#24364a]`, overlay luminoso à direita.
  - Esquerda: botão menu (só mobile) + **HubBrandMark compact**.
  - Direita: e-mail (md+), ícone de notificações (placeholder com toast), botão **Sair** com estilo uppercase denso.
- **Sidebar desktop:**
  - Posição `fixed left-0`, abaixo da barra (`top: 3.5rem`), altura `calc(100% - 3.5rem)`, `z-40`, **não** empurra o fluxo — o conteúdo principal compensa com `padding-left` dinâmico (`lg:pl-[3.25rem]` ou `lg:pl-[calc(3.25rem+14rem)]` quando a gaveta está aberta).
  - **Rail:** faixa estreita `~3.25rem` com ícones Material; estado activo com **barra esquerda** `border-l-[3px] border-tertiary` quando aplicável (evita duplicar indicadores entre rail e texto).
  - **Gaveta:** quando expandida, largura `w-56` com etiquetas de navegação; estado persistido por utilizador em `localStorage`.
  - Fundo da sidebar `bg-[#1a344d]` (variação do navy), scroll fino `sidebar-scrollbar`.
  - **Botão toggle** da gaveta: círculo pequeno sobre a borda direita da sidebar, `bg-tertiary`, sombra verde, ícone chevron.
  - Rodapé da sidebar: avatar circular com inicial, nome e papel (Administrador / Usuário) quando a gaveta está aberta.
- **Suporte a grupos:** itens com `children` ou `group` expandem sub-links com `expand_more` / `expand_less`; estado de grupo também persistido.
- **Mobile:** drawer fullscreen (`z-[90]`) com overlay escuro, lista vertical com ícone + texto; `body` com `overflow: hidden` enquanto aberto.

### 5.2 Área de conteúdo (cartão branco)

- **Invólucro por defeito:** `rounded-2xl bg-white` com sombra suave; pode ser substituído por `contentClassName` (ex.: governança usa cartão mais compacto `rounded-xl`).
- **Header interno da página:** fundo branco, `border-b border-slate-100`; `title` (`h1` em navy escuro), `subtitle` em `slate-600`, `headerActions` opcional.
- **`headerTabs`:** opcional (ex.: `/adm/*`) — por defeito separado por `border-t border-slate-100`; em governança, grupo de **NavLinks** em estilo pill (`rounded-xl bg-slate-50/95`), activo `bg-primary text-white shadow-sm`.
- **`<main>`:** `flex-1 overflow-y-auto`, fundo `bg-[#f8fafc]`, padding configurável (`mainClassName`).

### 5.3 Navegação (`appNavItems`)

Os itens visíveis na sidebar vêm de `frontend/src/lib/appNavItems.js` conforme `isAdmin`, governação HUB, portal (Hub vs Imóveis), etc. — o **layout** é sempre o mesmo; muda só o conjunto de destinos.

---

## 6. Governança administrativa (`/adm`)

**Layout:** `AdminGovernanceLayout` envolve rotas filhas com `AppShell` + `Outlet`.

- Título e subtítulo fixos no cabeçalho do shell («Config e governança»…).
- Tabs de módulos (Auditoria, Configurações, Etapas de cadastro, Catálogo de campos, Gestão de links, Utilizadores, Organizações) no **`headerTabs`** — ficam **fora** do scroll do main, alinhadas ao padrão descrito em [UI_APP_SHELL.md](./UI_APP_SHELL.md).
- **`contentClassName`** e **`mainClassName`** reduzem sensação de «caixa dentro de caixa» e aumentam larg útil para tabelas.

---

## 7. Módulos de exemplo no shell

### 7.1 CRM (`CrmHomePage`)

- Usa `AppShell` padrão com `max-w-[1800px]` no interior do main.
- Secções: cartão branco `border border-surface-container-high`, título de secção com **barra vertical** `w-1.5 h-6 bg-tertiary` + label uppercase — padrão MKDS.

### 7.2 Painel de campanhas

- Integrado no mesmo sistema de shell/navegação; detalhes de abas internas, filtros e tabelas estão em [MKDS.md](./MKDS.md) §3 e §4.

---

## 8. Estados globais e overlays

| Estado | Aspecto visual |
|--------|----------------|
| `Protected` (sessão a verificar) | Fullscreen `fixed inset-0 z-[60]`, `bg-primary`, texto branco uppercase denso — «Verificando sessão…» |
| `AdminOnly` (permissões) | Centrado em `min-h-screen`, `bg-surface-container-low`, texto primary uppercase — «Verificando permissões…» |
| Login a carregar (`LoginPage`) | `min-h-screen`, `bg-surface-container-low`, mesmo tratamento tipográfico — «Carregando…» |
| Toasts | `fixed bottom-4 right-4 z-[210]`; variantes `success` / `warning` / `info` / default com bordas e fundos semânticos |
| Alert / Confirm | Overlay `z-[200]`, fundo `bg-slate-900/50`, caixa `border-2 border-primary bg-white shadow-xl`, botões uppercase |

---

## 9. Utilitários CSS globais (`index.css`)

| Classe | Função |
|--------|--------|
| `.no-scrollbar` | Esconde barra de scroll mantendo scroll por gesto/trackpad (ex.: abas horizontais) |
| `.sidebar-scrollbar` | Scrollbar fina clara sobre fundos escuros da sidebar |
| `.hub-table-scrollbar` | Scrollbar fina escura sobre superfícies claras (formulários públicos, tabelas) |
| `.hub-public-fade-in` | Entrada suave `opacity + translateY`; respeita `prefers-reduced-motion` |

---

## 10. Rotas públicas vs protegidas (impacto visual)

Resumo de `frontend/src/App.jsx`:

- **Públicas:** `/entrada`, `/cadastro/organizacao`, `/homologacao/organizacao`, `/convite/organizacao`, `/login`, recuperação/redefinição de senha — sem `AppShell`; usam `AuthSplitLayout` ou páginas próprias.
- **Protegidas:** redireccionam para login se não houver sessão; utilizadores com pendência HUB podem ser enviados para `/acesso/pendente-hub`.
- **Admin:** `/adm/*` com `AdminOnly` + `AdminGovernanceLayout` (shell + tabs).
- **Supabase desligado (dev):** rotas simplificadas — painel de campanhas pode aparecer sem fluxo completo de login (comportamento documentado em MKDS §5).

---

## 11. Coerência com documentação de produto

- **[MKDS.md](./MKDS.md):** inventário de componentes por ficheiro, padrões de cartões, tabelas, funil e auth — usar como checklist ao criar ecrãs novos.
- **[UI_LOGIN_E_IDENTIDADE.md](./UI_LOGIN_E_IDENTIDADE.md):** identidade e mensagens; se algum token divergir, prevalece o implementado em `index.css` até revisão formal do design system (cf. MKDS §10.1).
- **Possível drift:** o MKDS menciona em alguns pontos o badge «Arqui System» junto à marca; o componente actual **HubBrandMark** mostra apenas a wordmark Obra10+. Ao atualizar a marca no produto, alinhar MKDS e este documento.

---

## 12. Mapa rápido ficheiro → papel no layout

| Ficheiro | Papel |
|----------|--------|
| `frontend/index.html` | Fonts, meta, classe do `body` |
| `frontend/src/index.css` | `@theme`, scrollbars, animação pública |
| `frontend/src/App.jsx` | Router, guards, providers |
| `frontend/src/components/AuthSplitLayout.jsx` | Split auth + header público |
| `frontend/src/components/AppShell.jsx` | Layout logado completo |
| `frontend/src/pages/AdminGovernanceLayout.jsx` | Tabs e invólucro `/adm` |
| `frontend/src/context/UiFeedbackContext.jsx` | Toasts e diálogos globais |

---

*Última revisão alinhada ao código em **2026-05-04**.*
