-- ---------------------------------------------------------------------------
-- Primeiro administrador HUB (apenas linha em hub_admins)
-- ---------------------------------------------------------------------------
-- Fluxo completo (Auth + palavra-passe + hub_admins): ver `../seed.sql`.
-- Alternativa manual:
-- 1) Supabase Dashboard → Authentication → Users → Add user.
-- 2) Copie o UUID do utilizador.
-- 3) Execute o insert abaixo (substitua o UUID).

insert into public.hub_admins (user_id)
values ('00000000-0000-0000-0000-000000000000'::uuid)
on conflict (user_id) do nothing;

-- Notas:
-- - Só utilizadores listados em hub_admins passam o guard do CRM (`/crm`).
-- - Para mais admins, repita o insert com outros auth.users.id.
-- - Em produção, prefira processo auditável (convite, painel interno) em vez de SQL manual.
