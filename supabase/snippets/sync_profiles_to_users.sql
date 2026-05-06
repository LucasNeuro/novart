-- Mantém public.users sincronizada com public.profiles (schema novo) sem quebrar o app atual.
-- Execute no SQL Editor (role postgres).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles não existe. Execute antes: supabase/snippets/bootstrap_profiles_auth_layer.sql';
  end if;
  if to_regclass('public.users') is null then
    raise exception 'public.users não existe neste projeto.';
  end if;
end $$;

-- 1) Garante chave única por auth_subject para permitir upsert seguro.
create unique index if not exists users_auth_subject_uq on public.users (auth_subject);

-- 2) Backfill de utilizadores já existentes em profiles.
insert into public.users (auth_subject, email, full_name, metadata)
select
  p.auth_subject,
  p.email,
  p.full_name,
  jsonb_build_object(
    'source', 'profiles_backfill',
    'role', p.role,
    'approval_status', p.approval_status
  )
from public.profiles p
on conflict (auth_subject) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  updated_at = now();

-- 3) Trigger para sincronizar novos cadastros/atualizações.
create or replace function public.sync_profiles_to_users_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_subject, email, full_name, metadata)
  values (
    new.auth_subject,
    new.email,
    new.full_name,
    jsonb_build_object(
      'source', 'profiles_trigger',
      'role', new.role,
      'approval_status', new.approval_status
    )
  )
  on conflict (auth_subject) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    metadata = coalesce(public.users.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_profiles_to_users on public.profiles;
create trigger trg_sync_profiles_to_users
after insert or update on public.profiles
for each row execute function public.sync_profiles_to_users_trg();

notify pgrst, 'reload schema';
