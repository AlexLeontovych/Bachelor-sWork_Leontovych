-- In-app project notifications for assignment and workflow changes.

begin;

create table if not exists public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.project_notifications
  drop constraint if exists project_notifications_type_check;

alter table public.project_notifications
  add constraint project_notifications_type_check
  check (type in ('project_assigned', 'project_status_changed', 'project_archived', 'project_restored'));

create index if not exists idx_project_notifications_recipient_created
  on public.project_notifications(recipient_user_id, created_at desc);

create index if not exists idx_project_notifications_unread
  on public.project_notifications(recipient_user_id, is_read, created_at desc);

create index if not exists idx_project_notifications_project_id
  on public.project_notifications(project_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_notifications'
  ) then
    alter publication supabase_realtime add table public.project_notifications;
  end if;
end $$;

alter table public.project_notifications enable row level security;

drop policy if exists "project_notifications_recipient_read" on public.project_notifications;
create policy "project_notifications_recipient_read"
on public.project_notifications
for select
to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists "project_notifications_recipient_update" on public.project_notifications;
create policy "project_notifications_recipient_update"
on public.project_notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

drop policy if exists "project_notifications_recipient_delete" on public.project_notifications;
create policy "project_notifications_recipient_delete"
on public.project_notifications
for delete
to authenticated
using (recipient_user_id = auth.uid());

create or replace function public.project_notification_status_label(project_status text)
returns text
language sql
immutable
as $$
  select case coalesce(project_status, 'development')
    when 'development' then 'Development'
    when 'qa' then 'QA review'
    when 'production' then 'Production'
    else initcap(replace(project_status, '_', ' '))
  end
$$;

create or replace function public.insert_project_notification(
  target_workspace_id uuid,
  target_project_id uuid,
  target_recipient_user_id uuid,
  target_actor_user_id uuid,
  notification_type text,
  notification_title text,
  notification_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_recipient_user_id is null then
    return;
  end if;

  if target_actor_user_id is not null and target_recipient_user_id = target_actor_user_id then
    return;
  end if;

  insert into public.project_notifications (
    workspace_id,
    project_id,
    recipient_user_id,
    actor_user_id,
    type,
    title,
    body
  )
  values (
    target_workspace_id,
    target_project_id,
    target_recipient_user_id,
    target_actor_user_id,
    notification_type,
    notification_title,
    notification_body
  );
end;
$$;

create or replace function public.notify_project_workflow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  recipient_id uuid;
  recipient_ids uuid[];
  project_label text := coalesce(new.name, 'Untitled project');
  status_label text;
begin
  if tg_op = 'INSERT' then
    if new.developer_id is not null then
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        new.developer_id,
        actor_id,
        'project_assigned',
        'Project assigned to you',
        format('You were assigned as developer on "%s".', project_label)
      );
    end if;

    if new.qa_id is not null then
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        new.qa_id,
        actor_id,
        'project_assigned',
        'Project assigned to you',
        format('You were assigned as QA on "%s".', project_label)
      );
    end if;

    return new;
  end if;

  if new.developer_id is distinct from old.developer_id and new.developer_id is not null then
    perform public.insert_project_notification(
      new.workspace_id,
      new.id,
      new.developer_id,
      actor_id,
      'project_assigned',
      'Project assigned to you',
      format('You were assigned as developer on "%s".', project_label)
    );
  end if;

  if new.qa_id is distinct from old.qa_id and new.qa_id is not null then
    perform public.insert_project_notification(
      new.workspace_id,
      new.id,
      new.qa_id,
      actor_id,
      'project_assigned',
      'Project assigned to you',
      format('You were assigned as QA on "%s".', project_label)
    );
  end if;

  if new.status is distinct from old.status then
    status_label := public.project_notification_status_label(new.status);
    select coalesce(array_agg(distinct recipient), '{}'::uuid[])
    into recipient_ids
    from unnest(array_remove(array[
      new.user_id,
      new.developer_id,
      new.qa_id
    ], null::uuid)) as recipient;

    foreach recipient_id in array recipient_ids loop
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        recipient_id,
        actor_id,
        'project_status_changed',
        'Project status changed',
        format('"%s" moved to %s.', project_label, status_label)
      );
    end loop;
  end if;

  if coalesce(new.is_archived, false) is distinct from coalesce(old.is_archived, false) then
    select coalesce(array_agg(distinct recipient), '{}'::uuid[])
    into recipient_ids
    from unnest(array_remove(array[
      new.user_id,
      new.developer_id,
      new.qa_id
    ], null::uuid)) as recipient;

    foreach recipient_id in array recipient_ids loop
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        recipient_id,
        actor_id,
        case when coalesce(new.is_archived, false) then 'project_archived' else 'project_restored' end,
        case when coalesce(new.is_archived, false) then 'Project archived' else 'Project restored' end,
        case
          when coalesce(new.is_archived, false) then format('"%s" was archived.', project_label)
          else format('"%s" was restored to the workflow.', project_label)
        end
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_notification_events on public.projects;

create trigger projects_notification_events
after insert or update on public.projects
for each row
execute function public.notify_project_workflow_change();

commit;
