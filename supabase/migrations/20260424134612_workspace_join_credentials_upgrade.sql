begin;

create table if not exists public.workspace_join_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  login_normalized text not null,
  password_hash text not null,
  is_enabled boolean not null default true,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_join_credentials_login_normalized_length_check
    check (char_length(trim(login_normalized)) >= 3)
);

create or replace function public.normalize_workspace_join_login()
returns trigger
language plpgsql
as $$
begin
  new.login_normalized := lower(trim(new.login_normalized));
  return new;
end;
$$;

drop trigger if exists normalize_workspace_join_login on public.workspace_join_credentials;
create trigger normalize_workspace_join_login
before insert or update on public.workspace_join_credentials
for each row
execute function public.normalize_workspace_join_login();

drop trigger if exists set_workspace_join_credentials_updated_at on public.workspace_join_credentials;
create trigger set_workspace_join_credentials_updated_at
before update on public.workspace_join_credentials
for each row
execute function public.set_row_updated_at();

create unique index if not exists idx_workspace_join_credentials_login_normalized
  on public.workspace_join_credentials(login_normalized);

create index if not exists idx_workspace_join_credentials_workspace_id
  on public.workspace_join_credentials(workspace_id);

create temporary table pg_temp.workspace_owner_upgrade_map (
  owner_user_id uuid not null,
  canonical_workspace_id uuid not null,
  duplicate_workspace_id uuid not null,
  primary key (owner_user_id, duplicate_workspace_id)
) on commit drop;

with ranked_workspaces as (
  select
    workspace.id as workspace_id,
    workspace.owner_user_id,
    first_value(workspace.id) over (
      partition by workspace.owner_user_id
      order by
        case workspace.status
          when 'active' then 0
          when 'pending_payment' then 1
          else 2
        end,
        case
          when workspace.type = 'team' then 0
          else 1
        end,
        coalesce(workspace.paid_at, workspace.created_at),
        workspace.created_at,
        workspace.id
    ) as canonical_workspace_id,
    count(*) over (partition by workspace.owner_user_id) as workspace_count
  from public.workspaces as workspace
  where workspace.status <> 'archived'
)
insert into pg_temp.workspace_owner_upgrade_map (
  owner_user_id,
  canonical_workspace_id,
  duplicate_workspace_id
)
select
  owner_user_id,
  canonical_workspace_id,
  workspace_id
from ranked_workspaces
where workspace_count > 1
  and workspace_id <> canonical_workspace_id;

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  workflow_role
)
select
  upgrade_map.canonical_workspace_id,
  member.user_id,
  case
    when member.role = 'owner' or member.user_id = canonical_workspace.owner_user_id then 'owner'
    else 'member'
  end,
  case
    when member.role = 'owner' or member.user_id = canonical_workspace.owner_user_id then null
    else member.workflow_role
  end
from pg_temp.workspace_owner_upgrade_map as upgrade_map
join public.workspaces as canonical_workspace
  on canonical_workspace.id = upgrade_map.canonical_workspace_id
join public.workspace_members as member
  on member.workspace_id = upgrade_map.duplicate_workspace_id
where member.user_id is not null
on conflict (workspace_id, user_id) do update
set role = case
    when public.workspace_members.role = 'owner' or excluded.role = 'owner' then 'owner'
    else 'member'
  end,
  workflow_role = case
    when public.workspace_members.role = 'owner' or excluded.role = 'owner' then null
    else coalesce(public.workspace_members.workflow_role, excluded.workflow_role)
  end,
  updated_at = now();

with pending_invite_ranks as (
  select
    invite.id,
    coalesce(upgrade_map.canonical_workspace_id, invite.workspace_id) as target_workspace_id,
    row_number() over (
      partition by coalesce(upgrade_map.canonical_workspace_id, invite.workspace_id), invite.email_normalized
      order by
        case
          when upgrade_map.duplicate_workspace_id is null then 0
          else 1
        end,
        invite.created_at desc,
        invite.id
    ) as invite_rank
  from public.workspace_invites as invite
  left join pg_temp.workspace_owner_upgrade_map as upgrade_map
    on upgrade_map.duplicate_workspace_id = invite.workspace_id
  where invite.status = 'pending'
)
update public.workspace_invites as invite
set status = 'revoked',
    updated_at = now()
from pending_invite_ranks as pending_rank
where invite.id = pending_rank.id
  and pending_rank.invite_rank > 1;

update public.workspace_invites as invite
set workspace_id = upgrade_map.canonical_workspace_id,
    updated_at = now()
from pg_temp.workspace_owner_upgrade_map as upgrade_map
where invite.workspace_id = upgrade_map.duplicate_workspace_id;

update public.projects as project
set workspace_id = upgrade_map.canonical_workspace_id
from pg_temp.workspace_owner_upgrade_map as upgrade_map
where project.workspace_id = upgrade_map.duplicate_workspace_id;

update public.workspace_payments as payment
set workspace_id = upgrade_map.canonical_workspace_id,
    updated_at = now()
from pg_temp.workspace_owner_upgrade_map as upgrade_map
where payment.workspace_id = upgrade_map.duplicate_workspace_id;

delete from public.workspace_members as member
using pg_temp.workspace_owner_upgrade_map as upgrade_map
where member.workspace_id = upgrade_map.duplicate_workspace_id;

update public.workspaces as workspace
set status = 'archived',
    updated_at = now()
from pg_temp.workspace_owner_upgrade_map as upgrade_map
where workspace.id = upgrade_map.duplicate_workspace_id
  and workspace.status <> 'archived';

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  workflow_role
)
select
  workspace.id,
  workspace.owner_user_id,
  'owner',
  null
from public.workspaces as workspace
where workspace.status <> 'archived'
on conflict (workspace_id, user_id) do update
set role = 'owner',
    workflow_role = null,
    updated_at = now();

drop index if exists idx_workspaces_personal_owner_unique;
create unique index if not exists idx_workspaces_owner_active_unique
  on public.workspaces(owner_user_id)
  where status <> 'archived';

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
  fallback_workspace public.workspaces%rowtype;
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
  end if;

  if target_workspace.id is null then
    select *
    into fallback_workspace
    from public.workspaces
    where owner_user_id = payment_record.user_id
      and status <> 'archived'
    order by
      case status
        when 'active' then 0
        when 'pending_payment' then 1
        else 2
      end,
      case
        when type = 'team' then 0
        else 1
      end,
      coalesce(paid_at, created_at),
      created_at,
      id
    limit 1
    for update;

    if found then
      target_workspace := fallback_workspace;
    end if;
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
  elsif payment_record.plan_type = 'team' then
    update public.workspaces
    set name = target_workspace_name,
        type = 'team',
        status = 'active',
        paid_at = coalesce(paid_at, now())
    where id = target_workspace.id
    returning * into target_workspace;
  else
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

alter table public.workspace_join_credentials enable row level security;

commit;
