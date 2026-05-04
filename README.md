# Novart / Obra10+ HUB

Monorepo leve: documentação de produto em `docs/` e aplicação **TanStack Start** em `web/`.

## Repositório

| Pasta | Conteúdo |
|-------|-----------|
| `docs/` | SPEC, MKDS, guia de implementação, layout visual |
| `web/` | Frontend: TanStack Start, TanStack Router, Tailwind v4, cliente Supabase |
| **`supabase/obra10_hub_init.sql`** | Schema completo (ex.: `profiles`, funis, RPCs); primeiro registo via `/cadastro` = owner |
| **`supabase/primeiro_owner.sql`** | Só Auth + linha **owner** em `public.profiles` (schema já criado) |
| `supabase/config.toml` | Supabase CLI local (`supabase start` / `db reset`; seed aponta para o init acima) |

## Arranque rápido

```bash
cd web
cp .env.example .env.local
# Edite .env.local com URL e anon key do Supabase

npm install
npm run dev
```

A app serve em `http://localhost:3000` por defeito.

## Supabase

1. Cria o projeto em [Supabase](https://supabase.com).
2. **SQL Editor** → colar **`supabase/obra10_hub_init.sql`**. **`NOTIFY`** já está no script.
3. **`web/.env.local`** com URL + anon key deste projeto.
4. **Fluxo:** `/cadastro` (1.º = owner aprovado; outros HUB = pending até o owner aprovar em **`/crm/aprovacoes`**), `/login`, CRM.

**Stack local (opcional):** com a CLI, `supabase db reset` corre o ficheiro indicado em `[db.seed]` (`obra10_hub_init.sql`). Não há migrações versionadas neste repo — o schema vive só nesse SQL.

Alinha **`supabase/config.toml` → `[db].major_version`** com o Postgres do cloud se fores usar stack local.

## Deploy (Render) e confirmação de e-mail

A app é servida por **Nitro** (`npm run build` → `.output/server/index.mjs`). Variáveis `VITE_*` são embutidas no **build**.

### Supabase (obrigatório para o link do e-mail)

1. **Authentication → URL configuration**
   - **Site URL:** a URL pública da app (ex. `https://nome-do-servico.onrender.com`).
   - **Redirect URLs:** inclui a mesma URL e, por segurança, `https://nome-do-servico.onrender.com/**`.
2. O projecto usa `detectSessionInUrl` no cliente; após clicar no e-mail, o utilizador pode ir para `/login` (o `signUp` envia `emailRedirectTo` com origem `VITE_APP_ORIGIN`).
3. **Authentication → Emails:** com confirmação ligada, o Supabase envia o mail (SMTP próprio opcional em **Project Settings → Auth**).

### Render — serviço Node (recomendado: env no build)

1. **New → Web Service** → liga o repositório.
2. **Root Directory:** `web`
3. **Build Command:** `npm ci && npm run build`
4. **Start Command:** `npm run start`
5. **Environment** (Environment Variables), antes do primeiro deploy ou ao voltar a fazer build:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_ORIGIN` = URL **https** do serviço Render (sem barra final), igual ao **Site URL** do Supabase.

Depois de mudar `VITE_*`, faz **manual deploy** para rebuildar.

### Render — Docker

Raiz do Docker: pasta `web` (Dockerfile em `web/Dockerfile`). Passa **Docker Build Arguments** com os mesmos três valores `VITE_*` (no painel do serviço Docker: secção de build args, conforme a documentação Render).

## Próximos passos

Ver `docs/guia-implementacao.md` (auth HUB, shell, `/crm`, formulários).

## Responsividade

A Obra10+ HUB deve ser **100% responsiva** (mobile-first, ~320px até desktop). Convenções: **`docs/guia-implementacao.md`** — §4.1.1 e checklist do primeiro marco.
