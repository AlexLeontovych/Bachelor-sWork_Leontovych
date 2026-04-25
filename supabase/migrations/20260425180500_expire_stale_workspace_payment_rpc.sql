begin;

create or replace function public.expire_stale_workspace_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  expired_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to expire stale workspace payments.';
  end if;

  update public.workspace_payments
  set status = 'failed',
      raw_response = coalesce(raw_response, '{}'::jsonb) ||
        jsonb_build_object(
          'expiredReason', 'Payment was not confirmed within 3 minutes.',
          'expiredAt', now(),
          'expiredBy', 'client_checkout_guard'
        ),
      updated_at = now()
  where user_id = current_user_id
    and status in ('pending', 'processing')
    and created_at < now() - interval '3 minutes';

  get diagnostics expired_count = row_count;

  return expired_count;
end;
$$;

grant execute on function public.expire_stale_workspace_payments() to authenticated;

commit;
