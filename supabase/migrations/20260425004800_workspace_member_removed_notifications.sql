-- Notify workspace members when a teammate is removed from the workspace.

begin;

alter table public.project_notifications
  drop constraint if exists project_notifications_type_check;

alter table public.project_notifications
  add constraint project_notifications_type_check
  check (type in (
    'project_assigned',
    'project_unassigned',
    'project_status_changed',
    'project_archived',
    'project_restored',
    'workspace_member_joined',
    'workspace_member_removed',
    'workspace_welcome'
  ));

create or replace function public.workspace_notification_role_label(member_role text, workflow_role text)
returns text
language sql
immutable
as $$
  select case
    when member_role = 'owner' then 'Team Lead'
    when workflow_role = 'qa' then 'QA Engineer'
    when workflow_role = 'developer' then 'Developer'
    else 'Workspace member'
  end
$$;

create or replace function public.notify_workspace_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  recipient_id uuid;
  removed_member_name text;
  removed_member_role text;
  workspace_name text;
begin
  select coalesce(nullif(trim(profile.full_name), ''), profile.email, 'Workspace member')
  into removed_member_name
  from public.profiles as profile
  where profile.id = old.user_id;

  select coalesce(nullif(trim(workspace.name), ''), 'workspace')
  into workspace_name
  from public.workspaces as workspace
  where workspace.id = old.workspace_id;

  removed_member_role := public.workspace_notification_role_label(old.role, old.workflow_role);

  for recipient_id in
    select member.user_id
    from public.workspace_members as member
    where member.workspace_id = old.workspace_id
      and member.user_id <> old.user_id
  loop
    perform public.insert_project_notification(
      old.workspace_id,
      null,
      recipient_id,
      actor_id,
      'workspace_member_removed',
      'Workspace member removed',
      format('%s was removed from %s. Role: %s.', removed_member_name, workspace_name, removed_member_role)
    );
  end loop;

  return old;
end;
$$;

drop trigger if exists workspace_member_removed_notifications on public.workspace_members;

create trigger workspace_member_removed_notifications
after delete on public.workspace_members
for each row
execute function public.notify_workspace_member_removed();

commit;
