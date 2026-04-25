begin;

alter table public.profiles
  drop constraint if exists profiles_team_role_check;

alter table public.profiles
  add constraint profiles_team_role_check
  check (team_role in ('developer', 'qa', 'lead') or team_role is null);

alter table public.workspace_members
  drop constraint if exists workspace_members_workflow_role_check;

alter table public.workspace_members
  add constraint workspace_members_workflow_role_check
  check (workflow_role in ('developer', 'qa', 'lead') or workflow_role is null);

alter table public.workspace_invites
  drop constraint if exists workspace_invites_workflow_role_check;

alter table public.workspace_invites
  add constraint workspace_invites_workflow_role_check
  check (workflow_role in ('developer', 'qa', 'lead'));

alter table public.workspace_join_requests
  drop constraint if exists workspace_join_requests_workflow_role_check;

alter table public.workspace_join_requests
  add constraint workspace_join_requests_workflow_role_check
  check (workflow_role is null or workflow_role in ('developer', 'qa', 'lead'));

create or replace function public.workspace_notification_role_label(member_role text, workflow_role text)
returns text
language sql
immutable
as $$
  select case
    when member_role = 'owner' then 'Team Lead'
    when workflow_role = 'lead' then 'Team Lead'
    when workflow_role = 'qa' then 'QA Engineer'
    when workflow_role = 'developer' then 'Developer'
    else 'Workspace member'
  end
$$;

commit;
