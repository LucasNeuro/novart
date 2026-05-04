-- Opcional: cria utilizador Auth + perfil owner (para dev manual).
-- NÃO correr se quiser que o PRIMEIRO registo em /cadastro seja o único owner:
-- nesse caso use remover_usuarios_por_email.sql e cadastre-se pela app.
-- Só pode existir um owner aprovado (índice único em profiles).

create extension if not exists pgcrypto;

do $$
declare
  v_email constant text := 'lucas.marcondes@clicvendy.com.br';
  v_password constant text := $pw$@sacola47$pw$;
  v_auth_id uuid;
  v_new_auth constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_encrypted_pw text;
begin
  select id into v_auth_id from auth.users where id = v_new_auth limit 1;
  if v_auth_id is null then
    select id into v_auth_id from auth.users where lower(email) = lower(v_email) limit 1;
  end if;

  if v_auth_id is null then
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      v_new_auth,
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
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_new_auth,
      jsonb_build_object('sub', v_new_auth::text, 'email', v_email),
      'email',
      v_new_auth::text,
      now(),
      now(),
      now()
    );
    v_auth_id := v_new_auth;
  end if;

  insert into public.profiles (auth_subject, email, full_name, role, approval_status)
  values (v_auth_id, v_email, 'Owner dev', 'owner', 'approved')
  on conflict (auth_subject) do update
  set
    email = excluded.email,
    role = 'owner',
    approval_status = 'approved',
    updated_at = now ();
end $$;

notify pgrst, 'reload schema';
