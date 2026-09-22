-- Atomic, idempotent multi-record sync. Additive: existing sync RPC is unchanged.
-- Intended for small workflows such as linked order + inventory receipts.
create table if not exists public.tracker_atomic_operations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, operation_id)
);
alter table public.tracker_atomic_operations enable row level security;
revoke all on table public.tracker_atomic_operations from public, anon, authenticated;
comment on table public.tracker_atomic_operations is
  'Private idempotency ledger. Access exclusively through authorized atomic sync RPC.';

create or replace function public.sync_tracker_records_atomic(
  target_workspace uuid,
  operation_id uuid,
  changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  previous_request jsonb;
  previous_result jsonb;
  response jsonb;
  final_result jsonb;
begin
  if auth.uid() is null or not public.can_edit_workspace(target_workspace) then
    raise exception 'Edit access required';
  end if;

  if operation_id is null then raise exception 'operation_id is required'; end if;
  if changes is null or jsonb_typeof(changes) <> 'array'
    or jsonb_array_length(changes) < 1 or jsonb_array_length(changes) > 50 then
    raise exception 'Provide between 1 and 50 record changes';
  end if;
  if exists (
    select 1 from jsonb_array_elements(changes) as item(value)
    group by item.value->>'record_type', item.value->>'record_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate record keys in atomic operation';
  end if;

  -- Serialize retries of this exact operation, including concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_workspace::text || ':' || operation_id::text, 0)
  );

  select op.request, op.result into previous_request, previous_result
    from public.tracker_atomic_operations op
    where op.workspace_id = target_workspace and op.operation_id = sync_tracker_records_atomic.operation_id;
  if found then
    if previous_request <> changes then
      raise exception 'Operation ID was reused with different changes';
    end if;
    return previous_result || jsonb_build_object('replayed', true);
  end if;

  -- A caught exception creates a PostgreSQL subtransaction. If even ONE
  -- version conflicts, roll back ALL prior writes by the legacy guarded RPC.
  begin
    response := public.sync_tracker_records_guarded(target_workspace, changes);
    if jsonb_array_length(coalesce(response->'conflicts', '[]'::jsonb)) > 0 then
      raise sqlstate 'ZT001' using message = 'Atomic operation has version conflicts';
    end if;

    final_result := jsonb_build_object(
      'applied', coalesce(response->'applied', '[]'::jsonb),
      'conflicts', '[]'::jsonb,
      'replayed', false,
      'operation_id', operation_id
    );
    insert into public.tracker_atomic_operations(
      workspace_id, operation_id, request, result, created_by
    ) values (target_workspace, operation_id, changes, final_result, auth.uid());
    return final_result;
  exception
    when sqlstate 'ZT001' then
      return jsonb_build_object(
        'applied', '[]'::jsonb,
        'conflicts', coalesce(response->'conflicts', '[]'::jsonb),
        'replayed', false,
        'operation_id', operation_id
      );
  end;
end;
$function$;

revoke all on function public.sync_tracker_records_atomic(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.sync_tracker_records_atomic(uuid, uuid, jsonb)
  to authenticated;
comment on function public.sync_tracker_records_atomic(uuid, uuid, jsonb) is
  'Apply up to 50 version-checked record changes all-or-nothing, with operation-ID replay protection.';
