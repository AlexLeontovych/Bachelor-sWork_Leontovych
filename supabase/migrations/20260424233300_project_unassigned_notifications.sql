-- Notify previous assignees when a project is reassigned away from them.

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
    'project_restored'
  ));

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

  if new.developer_id is distinct from old.developer_id then
    if old.developer_id is not null then
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        old.developer_id,
        actor_id,
        'project_unassigned',
        'Project reassigned from you',
        format('"%s" is no longer assigned to you as developer.', project_label)
      );
    end if;

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
  end if;

  if new.qa_id is distinct from old.qa_id then
    if old.qa_id is not null then
      perform public.insert_project_notification(
        new.workspace_id,
        new.id,
        old.qa_id,
        actor_id,
        'project_unassigned',
        'Project reassigned from you',
        format('"%s" is no longer assigned to you as QA.', project_label)
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

commit;
