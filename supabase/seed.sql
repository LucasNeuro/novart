-- =============================================================================
-- Seed: primeiro HUB owner (Auth + hub_admins)
-- =============================================================================
-- AVISO DE SEGURANÇA
-- - Este ficheiro contém credenciais em texto para desenvolvimento / equipa fechada.
-- - NÃO commite em repositório público; rode apenas em ambientes controlados.
-- - Em produção: crie o user no Dashboard ou via Admin API e altere a palavra-passe.
--
-- Como aplicar
-- - Local (CLI): `supabase db reset` (corre migrações + este seed), ou
-- - Remoto: SQL Editor no projeto Supabase (requer permissões em auth.*).
--
-- Dependências: migração                               20260504160000_crm_triagem_core.sql
-- Extensão: pgcrypto (bcrypt via crypt(..., gen_salt('bf')))
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_email constant text := 'lucas.marcondes@clicvendy.com.br';
  v_password constant text := $pw$@sacola47$pw$;
  v_user_id uuid;
  v_new_id constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_encrypted_pw text;
begin
  select id
  into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  if v_user_id is null then
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_new_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', v_email),
      'email',
      v_new_id::text,
      now(),
      now(),
      now()
    );

    v_user_id := v_new_id;
    raise notice 'HUB owner: criado auth user %', v_email;
  else
    raise notice 'HUB owner: auth user já existia para %, a manter UUID %', v_email, v_user_id;
  end if;

  insert into public.hub_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  raise notice 'HUB owner: hub_admins garantido para user_id %', v_user_id;
end $$;
