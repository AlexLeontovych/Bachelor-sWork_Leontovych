-- Let existing workspace owners/members accept or decline new workspace invitations.

begin;

alter table public.workspace_invites
  drop constraint if exists workspace_invites_status_check;

alter table public.workspace_invites
  add constraint workspace_invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired'));

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
    'workspace_invite_received',
    'workspace_welcome'
  ));

create or replace function public.insert_workspace_invite_notification(
  target_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  invitee_profile_id uuid;
  invitee_workspace_count integer;
  workspace_name text;
begin
  select invite.id,
         invite.workspace_id,
         invite.email_normalized,
         invite.workflow_role,
         invite.invited_by,
         workspace.name as workspace_name
  into invite_record
  from public.workspace_invites as invite
  join public.workspaces as workspace
    on workspace.id = invite.workspace_id
  where invite.id = target_invite_id
    and invite.status = 'pending'
    and (invite.expires_at is null or invite.expires_at >= now());

  if invite_record.id is null then
    return;
  end if;

  select profile.id
  into invitee_profile_id
  from public.profiles as profile
  where lower(trim(profile.email)) = invite_record.email_normalized
  limit 1;

  if invitee_profile_id is null then
    return;
  end if;

  select count(*)
  into invitee_workspace_count
  from public.workspace_members as member
  join public.workspaces as workspace
    on workspace.id = member.workspace_id
  where member.user_id = invitee_profile_id
    and workspace.status <> 'archived';

  if invitee_workspace_count = 0 then
    return;
  end if;

  workspace_name := coalesce(nullif(trim(invite_record.workspace_name), ''), 'workspace');

  if exists (
    select 1
    from public.project_notifications as notification
    where notification.workspace_id = invite_record.workspace_id
      and notification.recipient_user_id = invitee_profile_id
      and notification.type = 'workspace_invite_received'
      and notification.is_read = false
  ) then
    return;
  end if;

  perform public.insert_project_notification(
    invite_record.workspace_id,
    null,
    invitee_profile_id,
    invite_record.invited_by,
    'workspace_invite_received',
    'Workspace invitation',
    format('You were invited to join %s as %s. Open this notification to accept or decline.', workspace_name, public.workspace_notification_role_label('member', invite_record.workflow_role))
  );
end;
$$;

create or replace function public.notify_workspace_invite_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_workspace_invite_notification(new.id);
  return new;
end;
$$;

drop trigger if exists workspace_invite_created_notifications on public.workspace_invites;

create trigger workspace_invite_created_notifications
after insert on public.workspace_invites
for each row
execute function public.notify_workspace_invite_created();

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
  active_workspace_count integer := 0;
  claimed_count integer := 0;
begin
  normalized_email := lower(trim(coalesce(p_email, '')));

  if normalized_email = '' then
    return 0;
  end if;

  select count(*)
  into active_workspace_count
  from public.workspace_members as member
  join public.workspaces as workspace
    on workspace.id = member.workspace_id
  where member.user_id = p_user_id
    and workspace.status <> 'archived';

  if active_workspace_count > 0 then
    for invite_record in
      select id
      from public.workspace_invites
      where email_normalized = normalized_email
        and status = 'pending'
        and (expires_at is null or expires_at >= now())
    loop
      perform public.insert_workspace_invite_notification(invite_record.id);
    end loop;

    update public.workspace_invites
    set status = 'expired',
        updated_at = now()
    where status = 'pending'
      and expires_at is not null
      and expires_at < now();

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

commit;
