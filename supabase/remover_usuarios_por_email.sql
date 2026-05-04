-- Apaga utilizadores Auth e, se existirem, linhas em tabelas públicas ligadas ao auth.
-- Executar no SQL Editor como role postgres.
-- Ajuste o array `emails` antes de correr.
--
-- Nota: se public.profiles (ou public.users) ainda NÃO foi criada — ex. init SQL ainda
-- não aplicado — este script remove na mesma o utilizador em auth.*.

do $$
declare
  emails text[] := array[
    'lucas.marcondes@clicvendy.com.br'::text,
    'lucasoffgod@hotmail.com'::text
  ];
  em text;
  uid uuid;
  has_profiles boolean;
  has_users_auth_subject boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) into has_profiles;

  select exists (
    select 1
    from information_schema.columns c
    join information_schema.tables t
      on c.table_schema = t.table_schema and c.table_name = t.table_name
    where c.table_schema = 'public'
      and c.table_name = 'users'
      and c.column_name = 'auth_subject'
  ) into has_users_auth_subject;

  foreach em in array emails
  loop
    em := trim(lower(em));
    if em = '' then
      continue;
    end if;

    select u.id into uid from auth.users u where lower(trim(u.email)) = em limit 1;
    if uid is null then
      raise notice 'Nenhum utilizador Auth com e-mail: %', em;
      continue;
    end if;

    if has_profiles then
      delete from public.profiles where auth_subject = uid;
    end if;

    if has_users_auth_subject then
      execute 'delete from public.users where auth_subject = $1' using uid;
    end if;

    delete from auth.identities where user_id = uid;

    -- Em algumas versões Supabase, user_id em sessions/refresh_tokens é varchar, não uuid.
    begin
      delete from auth.sessions where user_id::text = uid::text;
    exception
      when undefined_table then null;
    end;
    begin
      delete from auth.refresh_tokens where user_id::text = uid::text;
    exception
      when undefined_table then null;
    end;
    begin
      delete from auth.mfa_factors where user_id::text = uid::text;
    exception
      when undefined_table then null;
    end;

    delete from auth.users where id = uid;
    raise notice 'Removido Auth + dados públicos (se existiam): %', em;
  end loop;
end $$;

notify pgrst, 'reload schema';
