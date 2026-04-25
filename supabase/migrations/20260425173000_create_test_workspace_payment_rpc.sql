begin;

create or replace function public.create_test_workspace_payment(p_plan_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_plan_type text := lower(trim(coalesce(p_plan_type, '')));
  profile_record public.profiles%rowtype;
  existing_workspace public.workspaces%rowtype;
  payment_record public.workspace_payments%rowtype;
  activated_workspace_id uuid;
  test_provider_order_id text;
  test_workspace_name text;
  test_amount_minor integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create a test payment.';
  end if;

  if normalized_plan_type not in ('personal', 'team') then
    raise exception 'Unsupported workspace plan type.';
  end if;

  select *
  into profile_record
  from public.profiles
  where id = current_user_id;

  if not found then
    raise exception 'Profile record was not found.';
  end if;

  select *
  into existing_workspace
  from public.workspaces
  where owner_user_id = current_user_id
    and type = normalized_plan_type
    and status <> 'archived'
  order by created_at asc
  limit 1;

  if found then
    if normalized_plan_type = 'team' then
      raise exception 'You already have an active corporate workspace.';
    end if;

    raise exception 'You already have an active solo workspace.';
  end if;

  test_amount_minor := case
    when normalized_plan_type = 'team' then 200
    else 100
  end;
  test_workspace_name := coalesce(
    nullif(trim(profile_record.full_name), ''),
    split_part(profile_record.email, '@', 1),
    'Creative Studio'
  ) || case
    when normalized_plan_type = 'team' then ' corporate workspace'
    else ' workspace'
  end;
  test_provider_order_id := 'test-workspace-' || normalized_plan_type || '-' || extract(epoch from clock_timestamp())::bigint || '-' || gen_random_uuid()::text;

  insert into public.workspace_payments (
    user_id,
    workspace_id,
    workspace_name,
    plan_type,
    amount_minor,
    currency,
    provider,
    provider_order_id,
    provider_payment_id,
    status,
    checkout_url,
    raw_request,
    raw_response,
    paid_at
  )
  values (
    current_user_id,
    null,
    test_workspace_name,
    normalized_plan_type,
    test_amount_minor,
    'UAH',
    'monobank',
    test_provider_order_id,
    test_provider_order_id,
    'processing',
    null,
    jsonb_build_object('testPayment', true, 'source', 'rpc'),
    jsonb_build_object('testPayment', true, 'status', 'paid', 'source', 'rpc'),
    now()
  )
  returning * into payment_record;

  activated_workspace_id := public.activate_workspace_payment(
    payment_record.id,
    test_provider_order_id,
    jsonb_build_object(
      'testPayment', true,
      'status', 'paid',
      'source', 'rpc',
      'activatedAt', now()
    )
  );

  return jsonb_build_object(
    'workspaceId', activated_workspace_id,
    'orderId', test_provider_order_id,
    'paymentId', payment_record.id
  );
end;
$$;

grant execute on function public.create_test_workspace_payment(text) to authenticated;

commit;
