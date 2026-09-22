alter table public.tracker_records
  add column if not exists record_version bigint not null default 1;

alter table public.tracker_records
  drop constraint if exists tracker_records_record_version_check;

alter table public.tracker_records
  add constraint tracker_records_record_version_check check (record_version >= 1);

create or replace function public.bump_tracker_record_version()
returns trigger
language plpgsql
set search_path = 'public', 'pg_catalog'
as $$
begin
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

drop trigger if exists tracker_record_version_bump on public.tracker_records;
create trigger tracker_record_version_bump
before update on public.tracker_records
for each row execute function public.bump_tracker_record_version();

create or replace function public.sync_tracker_records_guarded(
  target_workspace uuid,
  changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  ch jsonb;
  cur record;
  expected_version bigint;
  new_version bigint;
  req_type text;
  req_id text;
  req_deleted_at timestamptz;
  req_data jsonb;
  req_client text;
  applied jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
begin
  if not public.can_edit_workspace(target_workspace) then
    raise exception 'Edit access required';
  end if;

  if changes is null or jsonb_typeof(changes) <> 'array' then
    raise exception 'changes must be a JSON array';
  end if;

  for ch in select value from jsonb_array_elements(changes)
  loop
    req_type := nullif(ch->>'record_type','');
    req_id := nullif(ch->>'record_id','');
    expected_version := coalesce(nullif(ch->>'expected_version','')::bigint,0);
    req_client := nullif(ch->>'updated_client','');

    if req_type is null or req_id is null then
      raise exception 'record_type and record_id are required';
    end if;

    if ch ? 'deleted_at' and jsonb_typeof(ch->'deleted_at') <> 'null' then
      req_deleted_at := (ch->>'deleted_at')::timestamptz;
    else
      req_deleted_at := null;
    end if;

    if ch ? 'data' and jsonb_typeof(ch->'data') <> 'null' then
      req_data := ch->'data';
    else
      req_data := null;
    end if;

    select tr.record_version,tr.data,tr.deleted_at,tr.updated_at,tr.updated_by,tr.updated_client
      into cur
    from public.tracker_records tr
    where tr.workspace_id=target_workspace
      and tr.record_type=req_type
      and tr.record_id=req_id
    for update;

    if not found then
      if expected_version <> 0 then
        conflicts := conflicts || jsonb_build_array(jsonb_build_object(
          'record_type',req_type,'record_id',req_id,
          'expected_version',expected_version,'actual_version',0,
          'data',null,'deleted_at',null,'updated_at',null,'updated_by',null,'updated_client',null
        ));
        continue;
      end if;

      if req_deleted_at is not null then
        applied := applied || jsonb_build_array(jsonb_build_object(
          'record_type',req_type,'record_id',req_id,'record_version',0,'deleted_at',req_deleted_at
        ));
        continue;
      end if;

      insert into public.tracker_records(
        workspace_id,record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client
      )
      values(
        target_workspace,req_type,req_id,coalesce(req_data,'{}'::jsonb),null,
        clock_timestamp(),auth.uid(),req_client
      )
      returning record_version into new_version;

      applied := applied || jsonb_build_array(jsonb_build_object(
        'record_type',req_type,'record_id',req_id,'record_version',new_version,'deleted_at',null
      ));
      continue;
    end if;

    if req_deleted_at is not null and cur.deleted_at is not null then
      applied := applied || jsonb_build_array(jsonb_build_object(
        'record_type',req_type,'record_id',req_id,'record_version',cur.record_version,'deleted_at',cur.deleted_at
      ));
      continue;
    end if;

    if cur.record_version <> expected_version then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'record_type',req_type,'record_id',req_id,
        'expected_version',expected_version,'actual_version',cur.record_version,
        'data',cur.data,'deleted_at',cur.deleted_at,'updated_at',cur.updated_at,
        'updated_by',cur.updated_by,'updated_client',cur.updated_client
      ));
      continue;
    end if;

    update public.tracker_records
       set data=coalesce(req_data,cur.data),
           deleted_at=req_deleted_at,
           updated_at=clock_timestamp(),
           updated_by=auth.uid(),
           updated_client=req_client
     where workspace_id=target_workspace
       and record_type=req_type
       and record_id=req_id
     returning record_version into new_version;

    applied := applied || jsonb_build_array(jsonb_build_object(
      'record_type',req_type,'record_id',req_id,'record_version',new_version,'deleted_at',req_deleted_at
    ));
  end loop;

  return jsonb_build_object('applied',applied,'conflicts',conflicts);
end;
$$;

revoke all on function public.sync_tracker_records_guarded(uuid,jsonb) from public;
revoke all on function public.sync_tracker_records_guarded(uuid,jsonb) from anon;
grant execute on function public.sync_tracker_records_guarded(uuid,jsonb) to authenticated;
