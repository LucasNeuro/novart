# Novart / Obra10+ HUB

Monorepo leve: documentação de produto em `docs/` e aplicação **TanStack Start** em `web/`.

## Repositório

| Pasta | Conteúdo |
|-------|-----------|
| `docs/` | SPEC, MKDS, guia de implementação, layout visual |
| `web/` | Frontend: TanStack Start, TanStack Router, Tailwind v4, cliente Supabase |
| `supabase/migrations/` | SQL inicial (pipelines, triagem, eventos, RLS Administrador HUB) |

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

1. Crie um projeto em [Supabase](https://supabase.com).
2. Aplique as migrações em `supabase/migrations/` (SQL editor ou CLI).
3. Adicione o seu utilizador a `public.hub_admins` para testar políticas de triagem.

## Próximos passos

Ver `docs/guia-implementacao.md` (auth HUB, shell, `/crm`, formulários).
