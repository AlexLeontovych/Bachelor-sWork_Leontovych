-- Notify workspace users when a member is added by any backend path.

begin;

create or replace function public.notify_workspace_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  recipient_id uuid;
  joined_member_name text;
  joined_member_role text;
  workspace_name text;
  workspace_owner_id uuid;
begin
  select coalesce(nullif(trim(profile.full_name), ''), profile.email, 'New teammate')
  into joined_member_name
  from public.profiles as profile
  where profile.id = new.user_id;

  select
    coalesce(nullif(trim(workspace.name), ''), 'workspace'),
    workspace.owner_user_id
  into workspace_name, workspace_owner_id
  from public.workspaces as workspace
  where workspace.id = new.workspace_id;

  joined_member_role := public.workspace_notification_role_label(new.role, new.workflow_role);

  for recipient_id in
    select member.user_id
    from public.workspace_members as member
    where member.workspace_id = new.workspace_id
      and member.user_id <> new.user_id
  loop
    perform public.insert_project_notification(
      new.workspace_id,
      null,
      recipient_id,
      coalesce(actor_id, new.user_id),
      'workspace_member_joined',
      'New workspace member joined',
      format('%s joined %s as %s.', joined_member_name, workspace_name, joined_member_role)
    );
  end loop;

  perform public.insert_project_notification(
    new.workspace_id,
    null,
    new.user_id,
    workspace_owner_id,
    'workspace_welcome',
    format('Welcome to %s', workspace_name),
    format('Welcome aboard, %s! You joined %s as %s.', joined_member_name, workspace_name, joined_member_role)
  );

  return new;
end;
$$;

drop trigger if exists workspace_member_joined_notifications on public.workspace_members;

create trigger workspace_member_joined_notifications
after insert on public.workspace_members
for each row
execute function public.notify_workspace_member_joined();

commit;
