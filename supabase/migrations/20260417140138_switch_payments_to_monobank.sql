begin;

update public.workspace_payments
set provider = 'monobank',
    updated_at = now()
where provider = 'fondy';

alter table public.workspace_payments
  drop constraint if exists workspace_payments_provider_check;

alter table public.workspace_payments
  add constraint workspace_payments_provider_check
  check (provider in ('monobank'));

commit;
