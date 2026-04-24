-- Enable live workspace updates for project and member changes.

begin;

alter table public.workspace_members replica identity full;
alter table public.projects replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'projects'
    ) then
      alter publication supabase_realtime add table public.projects;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'workspace_members'
    ) then
      alter publication supabase_realtime add table public.workspace_members;
    end if;
  end if;
end $$;

commit;
