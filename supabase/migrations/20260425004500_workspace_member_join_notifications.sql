-- Support workspace join and welcome notifications in the shared notification feed.

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
    'workspace_welcome'
  ));

commit;
