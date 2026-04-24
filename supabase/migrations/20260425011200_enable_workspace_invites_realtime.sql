do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_invites'
  ) then
    alter publication supabase_realtime add table public.workspace_invites;
  end if;
end $$;

alter table public.workspace_invites replica identity full;
