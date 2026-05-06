-- Adiciona coluna para guardar a resposta da API OpenCNPJ (https://opencnpj.org/#api)
-- após consulta no cadastro. Executar no SQL Editor se a base já existir sem esta coluna.

alter table public.profiles
  add column if not exists opencnpj_payload jsonb not null default '{}'::jsonb;

comment on column public.profiles.opencnpj_payload is
  'JSON da consulta OpenCNPJ no cadastro (GET https://api.opencnpj.org/{cnpj}) + _obra10_meta.';

notify pgrst, 'reload schema';
