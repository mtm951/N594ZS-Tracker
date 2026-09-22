-- Manual Supabase smoke test for the additive atomic-sync RPC.
-- Run as a privileged SQL test in ONE session. Everything is rolled back.
-- A nonzero exception signals failure; no tracker records are retained.
begin;
do $atomic_test$
declare
  ws uuid := gen_random_uuid();
  actor uuid;
  op uuid := gen_random_uuid();
  request jsonb;
  first_result jsonb;
  replay_result jsonb;
  conflict_result jsonb;
  reused_id_rejected boolean := false;
  denied boolean := false;
begin
  select user_id into actor from public.workspace_members
    where workspace_id='1ead2eeb-4aeb-443f-bdf7-ad7a1c901bca'
      and role='owner' limit 1;
  if actor is null then raise exception 'Owner fixture unavailable'; end if;
  insert into public.workspaces(id,name,slug)
    values(ws,'Temporary atomic-RPC test','atomic-smoke-'||replace(ws::text,'-',''));
  insert into public.workspace_members(workspace_id,user_id,role)
    values(ws,actor,'owner');
  perform set_config('request.jwt.claim.sub',actor::text,true);

  request := jsonb_build_array(
    jsonb_build_object('record_type','part','record_id','test-part',
      'data',jsonb_build_object('id','test-part','stockQty',3),'expected_version',0),
    jsonb_build_object('record_type','order','record_id','test-order',
      'data',jsonb_build_object('id','test-order','receivedQty',3),'expected_version',0)
  );
  first_result := public.sync_tracker_records_atomic(ws,op,request);
  if jsonb_array_length(first_result->'applied')<>2 then
    raise exception 'Atomic create did not apply both records';
  end if;
  replay_result := public.sync_tracker_records_atomic(ws,op,request);
  if replay_result->>'replayed'<>'true' then
    raise exception 'Identical operation ID did not replay';
  end if;
  if exists(select 1 from public.tracker_records
      where workspace_id=ws and record_version<>1) then
    raise exception 'Replay modified records';
  end if;
  begin
    perform public.sync_tracker_records_atomic(ws,op,'[]'::jsonb);
  exception when others then
    reused_id_rejected := SQLERRM like '%reused with different%';
  end;
  if not reused_id_rejected then
    raise exception 'Same ID with a different request was not rejected';
  end if;

  conflict_result := public.sync_tracker_records_atomic(ws,gen_random_uuid(),
    jsonb_build_array(
      jsonb_build_object('record_type','part','record_id','must-rollback',
        'data',jsonb_build_object('id','must-rollback','stockQty',99),'expected_version',0),
      jsonb_build_object('record_type','order','record_id','test-order',
        'data',jsonb_build_object('id','test-order','receivedQty',99),'expected_version',0)
    ));
  if jsonb_array_length(conflict_result->'conflicts')<>1
      or jsonb_array_length(conflict_result->'applied')<>0 then
    raise exception 'Conflict response did not reject all writes';
  end if;
  if exists(select 1 from public.tracker_records
    where workspace_id=ws and record_id='must-rollback') then
    raise exception 'First record escaped a later conflict';
  end if;
  if (select count(*) from public.tracker_atomic_operations where workspace_id=ws)<>1 then
    raise exception 'Conflict created a false operation receipt';
  end if;

  perform set_config('request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000000',true);
  begin
    perform public.sync_tracker_records_atomic(ws,gen_random_uuid(),request);
  exception when others then
    denied := SQLERRM like '%Edit access required%';
  end;
  if not denied then raise exception 'Unauthorized request succeeded'; end if;
end;
$atomic_test$;
rollback;
