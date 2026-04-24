-- Paid workspace onboarding with personal and team workspaces.
-- This migration introduces workspace-scoped access, payment tracking,
-- pending email invites, and private-by-default project visibility.

begin;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('personal', 'team')),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('pending_payment', 'active', 'archived')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  workflow_role text check (workflow_role in ('developer', 'qa') or workflow_role is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  workflow_role text not null check (workflow_role in ('developer', 'qa')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  claimed_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  workspace_name text,
  plan_type text not null check (plan_type in ('personal', 'team')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'UAH',
  provider text not null check (provider in ('fondy')),
  provider_order_id text not null,
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  checkout_url text,
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_order_id)
);

alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists is_public_preview boolean not null default false;

create index if not exists idx_workspaces_owner_type on public.workspaces(owner_user_id, type);
create unique index if not exists idx_workspaces_personal_owner_unique
  on public.workspaces(owner_user_id)
  where type = 'personal';
create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_workspace_invites_workspace_id on public.workspace_invites(workspace_id);
create index if not exists idx_workspace_invites_email_normalized on public.workspace_invites(email_normalized);
create unique index if not exists idx_workspace_invites_pending_unique
  on public.workspace_invites(workspace_id, email_normalized)
  where status = 'pending';
create index if not exists idx_workspace_payments_user_id on public.workspace_payments(user_id);
create index if not exists idx_workspace_payments_status on public.workspace_payments(status);
create index if not exists idx_workspace_payments_order_id on public.workspace_payments(provider_order_id);
create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_projects_public_preview on public.projects(is_public_preview);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_row_updated_at();

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row
execute function public.set_row_updated_at();

drop trigger if exists set_workspace_invites_updated_at on public.workspace_invites;
create trigger set_workspace_invites_updated_at
before update on public.workspace_invites
for each row
execute function public.set_row_updated_at();

drop trigger if exists set_workspace_payments_updated_at on public.workspace_payments;
create trigger set_workspace_payments_updated_at
before update on public.workspace_payments
for each row
execute function public.set_row_updated_at();

create or replace function public.prepare_workspace_invite()
returns trigger
language plpgsql
as $$
begin
  new.email_normalized := lower(trim(new.email));
  new.email := new.email_normalized;
  new.invited_by := coalesce(new.invited_by, auth.uid());
  new.token_hash := coalesce(new.token_hash, md5(gen_random_uuid()::text || clock_timestamp()::text));
  new.expires_at := coalesce(new.expires_at, now() + interval '30 days');
  return new;
end;
$$;

drop trigger if exists prepare_workspace_invite on public.workspace_invites;
create trigger prepare_workspace_invite
before insert or update on public.workspace_invites
for each row
execute function public.prepare_workspace_invite();

create or replace function public.current_workspace_type(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select type
  from public.workspaces
  where id = p_workspace_id
$$;

create or replace function public.is_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_user_id
  )
$$;

create or replace function public.is_workspace_owner(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_user_id
      and role = 'owner'
  )
$$;

create or replace function public.current_workspace_membership_role(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id
$$;

create or replace function public.current_workspace_team_role(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when wm.role = 'owner' then 'lead'
    else coalesce(wm.workflow_role, 'developer')
  end
  from public.workspace_members as wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id
$$;

insert into public.workspaces (name, type, owner_user_id, status, paid_at)
select
  concat(
    coalesce(
      nullif(trim(coalesce(full_name, '')), ''),
      split_part(coalesce(email, 'workspace'), '@', 1),
      'Personal'
    ),
    ' workspace'
  ) as workspace_name,
  'personal',
  id,
  'active',
  now()
from public.profiles
where not exists (
  select 1
  from public.workspaces
  where owner_user_id = public.profiles.id
    and type = 'personal'
);

insert into public.workspaces (name, type, owner_user_id, status, paid_at)
select
  concat(
    coalesce(
      nullif(trim(coalesce(owner_profile.full_name, '')), ''),
      split_part(coalesce(owner_profile.email, 'team'), '@', 1),
      'Team'
    ),
    ' team workspace'
  ) as workspace_name,
  'team',
  project.user_id,
  'active',
  now()
from public.projects as project
join public.profiles as owner_profile
  on owner_profile.id = project.user_id
where project.user_id is not null
  and (
    coalesce(owner_profile.role, 'user') = 'admin'
    or (project.developer_id is not null and project.developer_id <> project.user_id)
    or project.qa_id is not null
  )
  and not exists (
    select 1
    from public.workspaces
    where owner_user_id = project.user_id
      and type = 'team'
  )
group by project.user_id, owner_profile.full_name, owner_profile.email;

insert into public.workspace_members (workspace_id, user_id, role, workflow_role)
select
  workspace.id,
  workspace.owner_user_id,
  'owner',
  null
from public.workspaces as workspace
on conflict (workspace_id, user_id) do update
set role = excluded.role;

update public.projects as project
set workspace_id = team_workspace.id
from public.workspaces as team_workspace,
     public.profiles as owner_profile
where project.workspace_id is null
  and owner_profile.id = project.user_id
  and team_workspace.owner_user_id = project.user_id
  and team_workspace.type = 'team'
  and (
    coalesce(owner_profile.role, 'user') = 'admin'
    or (project.developer_id is not null and project.developer_id <> project.user_id)
    or project.qa_id is not null
  );

update public.projects as project
set workspace_id = personal_workspace.id
from public.workspaces as personal_workspace
where project.workspace_id is null
  and personal_workspace.owner_user_id = project.user_id
  and personal_workspace.type = 'personal';

insert into public.workspace_members (workspace_id, user_id, role, workflow_role)
select distinct
  project.workspace_id,
  project.developer_id,
  'member',
  coalesce(profile.team_role, 'developer')
from public.projects as project
join public.workspaces as workspace
  on workspace.id = project.workspace_id
 and workspace.type = 'team'
left join public.profiles as profile
  on profile.id = project.developer_id
where project.workspace_id is not null
  and project.developer_id is not null
  and project.developer_id <> workspace.owner_user_id
on conflict (workspace_id, user_id) do update
set workflow_role = coalesce(excluded.workflow_role, public.workspace_members.workflow_role);

insert into public.workspace_members (workspace_id, user_id, role, workflow_role)
select distinct
  project.workspace_id,
  project.qa_id,
  'member',
  'qa'
from public.projects as project
join public.workspaces as workspace
  on workspace.id = project.workspace_id
 and workspace.type = 'team'
where project.workspace_id is not null
  and project.qa_id is not null
  and project.qa_id <> workspace.owner_user_id
on conflict (workspace_id, user_id) do update
set workflow_role = 'qa';

update public.workspace_members
set workflow_role = coalesce(workflow_role, 'developer')
where role = 'member'
  and workflow_role is null;

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
  target_workspace_id uuid;
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

  select id
  into target_workspace_id
  from public.workspaces
  where owner_user_id = payment_record.user_id
    and type = payment_record.plan_type
  order by created_at asc
  limit 1;

  if target_workspace_id is null then
    target_workspace_name := coalesce(
      nullif(trim(payment_record.workspace_name), ''),
      case
        when payment_record.plan_type = 'personal' then 'Personal workspace'
        else 'Team workspace'
      end
    );

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
    returning id into target_workspace_id;
  else
    update public.workspaces
    set status = 'active',
        paid_at = coalesce(paid_at, now())
    where id = target_workspace_id;
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    workflow_role
  )
  values (
    target_workspace_id,
    payment_record.user_id,
    'owner',
    null
  )
  on conflict (workspace_id, user_id) do update
  set role = 'owner',
      workflow_role = null,
      updated_at = now();

  update public.workspace_payments
  set workspace_id = target_workspace_id,
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw_response = coalesce(raw_response, '{}'::jsonb) || coalesce(p_raw_response, '{}'::jsonb),
      updated_at = now()
  where id = p_payment_id;

  return target_workspace_id;
end;
$$;

create or replace function public.claim_pending_workspace_invites(
  p_user_id uuid,
  p_email text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  normalized_email text;
  claimed_count integer := 0;
begin
  normalized_email := lower(trim(coalesce(p_email, '')));

  if normalized_email = '' then
    return 0;
  end if;

  for invite_record in
    update public.workspace_invites
    set status = 'accepted',
        claimed_by = p_user_id,
        updated_at = now()
    where email_normalized = normalized_email
      and status = 'pending'
      and (expires_at is null or expires_at >= now())
    returning workspace_id, workflow_role
  loop
    claimed_count := claimed_count + 1;

    insert into public.workspace_members (
      workspace_id,
      user_id,
      role,
      workflow_role
    )
    values (
      invite_record.workspace_id,
      p_user_id,
      'member',
      invite_record.workflow_role
    )
    on conflict (workspace_id, user_id) do update
    set workflow_role = coalesce(excluded.workflow_role, public.workspace_members.workflow_role),
        updated_at = now();
  end loop;

  update public.workspace_invites
  set status = 'expired',
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();

  return claimed_count;
end;
$$;

create or replace function public.validate_project_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_access_role text;
  actor_workspace_id uuid;
  actor_workspace_role text;
  actor_team_role text;
  actor_is_workspace_owner boolean;
  actor_workspace_type text;
begin
  if actor_id is null then
    raise exception 'Authentication is required to manage projects.';
  end if;

  actor_workspace_id := case
    when tg_op = 'INSERT' then new.workspace_id
    when tg_op = 'UPDATE' then coalesce(new.workspace_id, old.workspace_id)
    else old.workspace_id
  end;

  if actor_workspace_id is null then
    raise exception 'Each project must belong to a workspace.';
  end if;

  actor_access_role := public.current_access_role();
  actor_workspace_role := public.current_workspace_membership_role(actor_workspace_id, actor_id);
  actor_is_workspace_owner := public.is_workspace_owner(actor_workspace_id, actor_id);
  actor_team_role := coalesce(public.current_workspace_team_role(actor_workspace_id, actor_id), 'developer');
  actor_workspace_type := coalesce(public.current_workspace_type(actor_workspace_id), 'team');

  if actor_workspace_role is null and actor_access_role <> 'admin' then
    raise exception 'Only workspace members can manage projects.';
  end if;

  if tg_op <> 'DELETE' then
    if tg_op = 'UPDATE'
       and old.workspace_id is not null
       and new.workspace_id is distinct from old.workspace_id
       and actor_access_role <> 'admin' then
      raise exception 'Changing the project workspace is not supported.';
    end if;

    if new.developer_id is not null and not public.is_workspace_member(actor_workspace_id, new.developer_id) then
      raise exception 'The assigned developer must belong to the selected workspace.';
    end if;

    if new.qa_id is not null and not public.is_workspace_member(actor_workspace_id, new.qa_id) then
      raise exception 'The assigned QA must belong to the selected workspace.';
    end if;
  end if;

  if actor_access_role = 'admin' or actor_is_workspace_owner then
    if tg_op = 'INSERT' then
      new.workspace_id := actor_workspace_id;
      new.user_id := coalesce(new.user_id, actor_id);
      new.developer_id := coalesce(new.developer_id, actor_id);
      new.status := coalesce(new.status, 'development');
      new.is_archived := coalesce(new.is_archived, false);

      if actor_workspace_type = 'personal' and new.qa_id is null then
        new.qa_id := actor_id;
      end if;
    elsif tg_op = 'UPDATE' then
      new.workspace_id := old.workspace_id;

      if actor_workspace_type = 'personal' and new.qa_id is null then
        new.qa_id := actor_id;
      end if;

      if new.status = 'qa' and new.qa_id is null then
        raise exception 'Assign a QA before moving the project to QA.';
      end if;

      if coalesce(new.is_archived, false) and old.status <> 'production' then
        raise exception 'Only production projects can be archived.';
      end if;

      if coalesce(new.is_archived, false) and new.archived_at is null then
        new.archived_at := now();
      end if;

      if coalesce(new.is_archived, false) and new.archived_by is null then
        new.archived_by := actor_id;
      end if;

      if not coalesce(new.is_archived, false) then
        new.archived_at := null;
        new.archived_by := null;
      end if;
    end if;

    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if actor_team_role <> 'developer' then
      raise exception 'Only workspace owners and developers can create projects.';
    end if;

    new.workspace_id := actor_workspace_id;
    new.user_id := actor_id;
    new.developer_id := coalesce(new.developer_id, actor_id);
    new.status := 'development';
    new.is_archived := false;
    new.qa_feedback_note := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;

    if new.is_archived is distinct from old.is_archived
      or new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by then
      raise exception 'Only workspace owners can archive projects.';
    end if;

    if old.status = 'development' then
      if old.developer_id is distinct from actor_id then
        raise exception 'Only the assigned developer or workspace owner can update this project in Development.';
      end if;

      if actor_team_role <> 'developer' then
        raise exception 'Only developers can update projects in Development.';
      end if;

      if new.status not in ('development', 'qa') then
        raise exception 'Developers can only move projects from Development to QA.';
      end if;

      if new.status = 'qa' and new.qa_id is null then
        raise exception 'Assign a QA before sending the project to QA.';
      end if;
    elsif old.status = 'qa' then
      if old.qa_id is distinct from actor_id then
        raise exception 'Only the assigned QA or workspace owner can update this project in QA.';
      end if;

      if actor_team_role <> 'qa' then
        raise exception 'Only QA can update projects in QA.';
      end if;

      if new.status not in ('development', 'qa', 'production') then
        raise exception 'QA can only move projects to Development or Production.';
      end if;

      if new.status = 'development' and coalesce(trim(new.qa_feedback_note), '') = '' then
        raise exception 'Feedback is required when returning a project to Development.';
      end if;
    elsif old.status = 'production' then
      raise exception 'Only workspace owners can update projects in Production.';
    end if;

    if new.user_id is distinct from old.user_id then
      raise exception 'Only workspace owners can change the project creator.';
    end if;

    if new.developer_id is distinct from old.developer_id then
      raise exception 'Only workspace owners can change the assigned developer.';
    end if;

    if new.qa_id is distinct from old.qa_id then
      raise exception 'Only workspace owners can change the assigned QA.';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'development' then
      if old.developer_id is distinct from actor_id or actor_team_role <> 'developer' then
        raise exception 'Only the assigned developer or workspace owner can delete this project in Development.';
      end if;
    elsif old.status = 'qa' then
      if old.qa_id is distinct from actor_id or actor_team_role <> 'qa' then
        raise exception 'Only the assigned QA or workspace owner can delete this project in QA.';
      end if;
    else
      raise exception 'Only workspace owners can delete projects in Production.';
    end if;

    return old;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists projects_workflow_guard on public.projects;
create trigger projects_workflow_guard
before insert or update or delete on public.projects
for each row
execute function public.validate_project_workflow();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_payments enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "workspaces_member_read" on public.workspaces;
create policy "workspaces_member_read"
on public.workspaces
for select
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_member(id)
);

drop policy if exists "workspace_members_workspace_read" on public.workspace_members;
create policy "workspace_members_workspace_read"
on public.workspace_members
for select
to authenticated
using (
  public.current_user_is_admin()
  or user_id = auth.uid()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "workspace_members_owner_insert" on public.workspace_members;
create policy "workspace_members_owner_insert"
on public.workspace_members
for insert
to authenticated
with check (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_members_owner_update" on public.workspace_members;
create policy "workspace_members_owner_update"
on public.workspace_members
for update
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
)
with check (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_members_owner_delete" on public.workspace_members;
create policy "workspace_members_owner_delete"
on public.workspace_members
for delete
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_invites_owner_read" on public.workspace_invites;
create policy "workspace_invites_owner_read"
on public.workspace_invites
for select
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_invites_owner_insert" on public.workspace_invites;
create policy "workspace_invites_owner_insert"
on public.workspace_invites
for insert
to authenticated
with check (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_invites_owner_update" on public.workspace_invites;
create policy "workspace_invites_owner_update"
on public.workspace_invites
for update
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
)
with check (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_invites_owner_delete" on public.workspace_invites;
create policy "workspace_invites_owner_delete"
on public.workspace_invites
for delete
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_owner(workspace_id)
);

drop policy if exists "workspace_payments_self_read" on public.workspace_payments;
create policy "workspace_payments_self_read"
on public.workspace_payments
for select
to authenticated
using (
  public.current_user_is_admin()
  or user_id = auth.uid()
);

drop policy if exists "projects_guest_read" on public.projects;
create policy "projects_guest_read"
on public.projects
for select
to anon
using (is_public_preview = true);

drop policy if exists "projects_authenticated_read" on public.projects;
create policy "projects_authenticated_read"
on public.projects
for select
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "projects_authenticated_insert" on public.projects;
create policy "projects_authenticated_insert"
on public.projects
for insert
to authenticated
with check (
  public.current_user_is_admin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "projects_authenticated_update" on public.projects;
create policy "projects_authenticated_update"
on public.projects
for update
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_member(workspace_id)
)
with check (
  public.current_user_is_admin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "projects_authenticated_delete" on public.projects;
create policy "projects_authenticated_delete"
on public.projects
for delete
to authenticated
using (
  public.current_user_is_admin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_admin()
  or exists (
    select 1
    from public.workspace_members as actor_member
    join public.workspace_members as peer_member
      on peer_member.workspace_id = actor_member.workspace_id
    where actor_member.user_id = auth.uid()
      and peer_member.user_id = public.profiles.id
  )
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

commit;
