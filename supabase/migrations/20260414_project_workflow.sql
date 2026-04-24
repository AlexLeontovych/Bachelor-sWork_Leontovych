-- Workflow roles and project stage access control.
-- Apply this migration in Supabase before using the new team workflow UI.

begin;

-- If this migration is re-run after a partial failure, an old workflow trigger may
-- still exist and would block the project backfill below because SQL editor
-- sessions do not have auth.uid(). Drop it before any data updates.
drop trigger if exists projects_workflow_guard on public.projects;

alter table public.profiles
  add column if not exists team_role text;

update public.profiles
set team_role = 'developer'
where role <> 'admin'
  and (team_role is null or team_role = '');

alter table public.profiles
  drop constraint if exists profiles_team_role_check;

alter table public.profiles
  add constraint profiles_team_role_check
  check (team_role in ('developer', 'qa') or team_role is null);

alter table public.projects
  add column if not exists developer_id uuid references public.profiles(id) on delete set null,
  add column if not exists qa_id uuid references public.profiles(id) on delete set null,
  add column if not exists qa_handoff_note text,
  add column if not exists qa_feedback_note text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select distinct con.conname
    from pg_constraint as con
    join pg_class as rel
      on rel.oid = con.conrelid
    join pg_namespace as nsp
      on nsp.oid = rel.relnamespace
    join pg_attribute as attr
      on attr.attrelid = rel.oid
     and attr.attnum = any(con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'projects'
      and con.contype = 'c'
      and attr.attname = 'status'
  loop
    execute format('alter table public.projects drop constraint if exists %I', status_constraint.conname);
  end loop;
end $$;

update public.projects
set status = case
  when lower(coalesce(status, '')) in ('active', 'paused', 'development') then 'development'
  when lower(coalesce(status, '')) in ('qa', 'quality_assurance') then 'qa'
  when lower(coalesce(status, '')) in ('production', 'prod') then 'production'
  else 'development'
end;

alter table public.projects
  alter column status set default 'development';

alter table public.projects
  add constraint projects_status_check
  check (status in ('development', 'qa', 'production'));

update public.projects as projects
set developer_id = projects.user_id
from public.profiles as profiles
where projects.developer_id is null
  and profiles.id = projects.user_id
  and profiles.role <> 'admin';

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_developer_id on public.projects(developer_id);
create index if not exists idx_projects_qa_id on public.projects(qa_id);
create index if not exists idx_projects_is_archived on public.projects(is_archived);
create index if not exists idx_profiles_team_role on public.profiles(team_role);

create or replace function public.current_access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select team_role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_access_role() = 'admin', false)
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
  actor_team_role text;
begin
  if actor_id is null then
    raise exception 'Authentication is required to manage projects.';
  end if;

  actor_access_role := public.current_access_role();
  actor_team_role := coalesce(public.current_team_role(), 'developer');

  if actor_access_role = 'admin' then
    if tg_op = 'INSERT' then
      new.user_id := coalesce(new.user_id, actor_id);
      new.status := coalesce(new.status, 'development');
      new.is_archived := coalesce(new.is_archived, false);
    elsif tg_op = 'UPDATE' then
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
      raise exception 'Only team leads and developers can create projects.';
    end if;

    new.user_id := actor_id;
    new.developer_id := coalesce(new.developer_id, actor_id);
    new.status := 'development';
    new.is_archived := false;
    new.qa_feedback_note := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_archived is distinct from old.is_archived
      or new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by then
      raise exception 'Only team leads can archive projects.';
    end if;

    if old.status = 'development' then
      if old.developer_id is distinct from actor_id then
        raise exception 'Only the assigned developer or team lead can update this project in Development.';
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
        raise exception 'Only the assigned QA or team lead can update this project in QA.';
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
      raise exception 'Only team leads can update projects in Production.';
    end if;

    if new.user_id is distinct from old.user_id then
      raise exception 'Only team leads can change the project creator.';
    end if;

    if new.developer_id is distinct from old.developer_id then
      raise exception 'Only team leads can change the assigned developer.';
    end if;

    if new.qa_id is distinct from old.qa_id then
      raise exception 'Only team leads can change the assigned QA.';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'development' then
      if old.developer_id is distinct from actor_id or actor_team_role <> 'developer' then
        raise exception 'Only the assigned developer or team lead can delete this project in Development.';
      end if;
    elsif old.status = 'qa' then
      if old.qa_id is distinct from actor_id or actor_team_role <> 'qa' then
        raise exception 'Only the assigned QA or team lead can delete this project in QA.';
      end if;
    else
      raise exception 'Only team leads can delete projects in Production.';
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

alter table public.projects enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "projects_guest_read" on public.projects;
create policy "projects_guest_read"
on public.projects
for select
to anon
using (true);

drop policy if exists "projects_authenticated_read" on public.projects;
create policy "projects_authenticated_read"
on public.projects
for select
to authenticated
using (
  public.current_user_is_admin()
  or user_id = auth.uid()
  or developer_id = auth.uid()
  or qa_id = auth.uid()
);

drop policy if exists "projects_authenticated_insert" on public.projects;
create policy "projects_authenticated_insert"
on public.projects
for insert
to authenticated
with check (true);

drop policy if exists "projects_authenticated_update" on public.projects;
create policy "projects_authenticated_update"
on public.projects
for update
to authenticated
using (
  public.current_user_is_admin()
  or user_id = auth.uid()
  or developer_id = auth.uid()
  or qa_id = auth.uid()
)
with check (true);

drop policy if exists "projects_authenticated_delete" on public.projects;
create policy "projects_authenticated_delete"
on public.projects
for delete
to authenticated
using (
  public.current_user_is_admin()
  or user_id = auth.uid()
  or developer_id = auth.uid()
  or qa_id = auth.uid()
);

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

commit;
