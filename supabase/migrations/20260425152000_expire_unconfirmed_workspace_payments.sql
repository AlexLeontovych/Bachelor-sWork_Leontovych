begin;

create or replace function public.activate_workspace_payment(
  p_payment_id uuid,
  p_provider_payment_id text default null,
  p_raw_response jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.workspace_payments%rowtype;
  target_workspace public.workspaces%rowtype;
  target_workspace_name text;
begin
  select *
  into payment_record
  from public.workspace_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Workspace payment not found.';
  end if;

  if payment_record.workspace_id is not null and payment_record.status = 'paid' then
    update public.workspace_payments
    set provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        raw_response = coalesce(raw_response, '{}'::jsonb) || coalesce(p_raw_response, '{}'::jsonb),
        updated_at = now()
    where id = p_payment_id;

    return payment_record.workspace_id;
  end if;

  if payment_record.created_at < now() - interval '3 minutes' then
    update public.workspace_payments
    set status = 'failed',
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        raw_response = coalesce(raw_response, '{}'::jsonb) ||
          coalesce(p_raw_response, '{}'::jsonb) ||
          jsonb_build_object(
            'expiredReason', 'Payment was not confirmed within 3 minutes.',
            'expiredAt', now()
          ),
        updated_at = now()
    where id = p_payment_id;

    raise exception 'Payment confirmation window expired.';
  end if;

  if payment_record.workspace_id is not null then
    select *
    into target_workspace
    from public.workspaces
    where id = payment_record.workspace_id
    for update;

    if found and target_workspace.owner_user_id <> payment_record.user_id then
      raise exception 'The target workspace does not belong to the payment owner.';
    end if;

    if found and target_workspace.status = 'archived' then
      raise exception 'The target workspace is archived and cannot be activated.';
    end if;

    if found and payment_record.plan_type = 'team' and target_workspace.type <> 'team' then
      target_workspace := null;
    end if;
  end if;

  if target_workspace.id is null and payment_record.plan_type = 'personal' then
    select *
    into target_workspace
    from public.workspaces
    where owner_user_id = payment_record.user_id
      and type = 'personal'
      and status <> 'archived'
    order by
      case status
        when 'active' then 0
        when 'pending_payment' then 1
        else 2
      end,
      coalesce(paid_at, created_at),
      created_at,
      id
    limit 1
    for update;
  end if;

  target_workspace_name := coalesce(
    nullif(trim(payment_record.workspace_name), ''),
    nullif(trim(target_workspace.name), ''),
    case
      when payment_record.plan_type = 'team' then 'Corporate workspace'
      else 'Solo workspace'
    end
  );

  if target_workspace.id is null then
    insert into public.workspaces (
      name,
      type,
      owner_user_id,
      status,
      paid_at
    )
    values (
      target_workspace_name,
      payment_record.plan_type,
      payment_record.user_id,
      'active',
      now()
    )
    returning * into target_workspace;
  elsif payment_record.plan_type = 'personal' then
    if target_workspace.type = 'team' then
      raise exception 'A paid corporate workspace cannot be downgraded to a solo workspace.';
    end if;

    update public.workspaces
    set name = target_workspace_name,
        type = 'personal',
        status = 'active',
        paid_at = coalesce(paid_at, now())
    where id = target_workspace.id
    returning * into target_workspace;
  else
    update public.workspaces
    set name = target_workspace_name,
        type = 'team',
        status = 'active',
        paid_at = coalesce(paid_at, now())
    where id = target_workspace.id
    returning * into target_workspace;
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    workflow_role
  )
  values (
    target_workspace.id,
    payment_record.user_id,
    'owner',
    null
  )
  on conflict (workspace_id, user_id) do update
  set role = 'owner',
      workflow_role = null,
      updated_at = now();

  update public.workspace_payments
  set workspace_id = target_workspace.id,
      workspace_name = target_workspace.name,
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw_response = coalesce(raw_response, '{}'::jsonb) || coalesce(p_raw_response, '{}'::jsonb),
      updated_at = now()
  where id = p_payment_id;

  return target_workspace.id;
end;
$$;

commit;
