begin;

create table if not exists public.workspace_join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.profiles(id) on delete set null,
  workflow_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_join_requests_status_check
    check (status in ('pending', 'accepted', 'declined')),
  constraint workspace_join_requests_workflow_role_check
    check (workflow_role is null or workflow_role in ('developer', 'qa'))
);

drop trigger if exists set_workspace_join_requests_updated_at on public.workspace_join_requests;
create trigger set_workspace_join_requests_updated_at
before update on public.workspace_join_requests
for each row
execute function public.set_row_updated_at();

create unique index if not exists idx_workspace_join_requests_pending_unique
  on public.workspace_join_requests(workspace_id, requester_user_id)
  where status = 'pending';

create index if not exists idx_workspace_join_requests_workspace_status
  on public.workspace_join_requests(workspace_id, status, requested_at desc);

create index if not exists idx_workspace_join_requests_requester_status
  on public.workspace_join_requests(requester_user_id, status, requested_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_join_requests'
  ) then
    alter publication supabase_realtime add table public.workspace_join_requests;
  end if;
end $$;

alter table public.workspace_join_requests replica identity full;
alter table public.workspace_join_requests enable row level security;

drop policy if exists "workspace_join_requests_requester_read" on public.workspace_join_requests;
create policy "workspace_join_requests_requester_read"
on public.workspace_join_requests
for select
to authenticated
using (requester_user_id = auth.uid());

drop policy if exists "workspace_join_requests_owner_read" on public.workspace_join_requests;
create policy "workspace_join_requests_owner_read"
on public.workspace_join_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = workspace_join_requests.workspace_id
      and member.user_id = auth.uid()
      and member.role = 'owner'
  )
);

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
    'workspace_welcome',
    'workspace_invite_received',
    'workspace_join_requested',
    'workspace_join_accepted',
    'workspace_join_declined'
  ));

commit;
