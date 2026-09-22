create extension if not exists pg_cron with schema extensions;

create index if not exists activity_log_record_history_idx
  on public.activity_log (workspace_id, record_type, record_id, created_at desc);

create or replace function public.run_automatic_tracker_snapshots()
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  w record;
  payload jsonb;
  created_count integer := 0;
begin
  for w in
    select distinct workspace_id
    from public.tracker_records
  loop
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'record_type', record_type,
                 'record_id', record_id,
                 'data', data
               )
               order by record_type, record_id
             ),
             '[]'::jsonb
           )
      into payload
    from public.tracker_records
    where workspace_id = w.workspace_id
      and deleted_at is null;

    insert into public.tracker_snapshots(workspace_id,label,records,created_by)
    values(w.workspace_id,'Automatic daily snapshot',payload,null);

    delete from public.tracker_snapshots s
    where s.workspace_id = w.workspace_id
      and s.label = 'Automatic daily snapshot'
      and s.id in (
        select id
        from public.tracker_snapshots
        where workspace_id = w.workspace_id
          and label = 'Automatic daily snapshot'
        order by created_at desc
        offset 30
      );

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.run_automatic_tracker_snapshots() from public;
revoke all on function public.run_automatic_tracker_snapshots() from anon;
revoke all on function public.run_automatic_tracker_snapshots() from authenticated;
grant execute on function public.run_automatic_tracker_snapshots() to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'n594zs_daily_tracker_snapshot'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'n594zs_daily_tracker_snapshot',
    '15 6 * * *',
    'select public.run_automatic_tracker_snapshots();'
  );
end;
$$;
