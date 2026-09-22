create index if not exists tracker_parts_workspace_partno_idx
  on public.tracker_records (workspace_id, lower(data->>'partNo'))
  where record_type='part' and deleted_at is null;

create or replace function public.sync_on_hand_purchase_to_part()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_qty numeric := 0;
  v_pn text;
  v_desc text;
  v_vendor text;
  v_system text;
  v_location text;
  v_unit_price text;
  v_ship_date text;
  v_project_id text;
  v_part_record_id text;
  v_part_data jsonb;
  v_existing_qty numeric := 0;
  v_new_part_id bigint;
  v_lock_key text;
begin
  if new.record_type <> 'purchase' or new.deleted_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.record_type = 'purchase'
     and coalesce((old.data->>'inventoryApplied')::boolean,false) then
    new.data := new.data || jsonb_build_object(
      'inventoryApplied', true,
      'inventoryPartId', old.data->>'inventoryPartId'
    );
    return new;
  end if;

  if coalesce(new.data->>'disposition','') <> 'On Hand'
     or coalesce((new.data->>'inventoryApplied')::boolean,false) then
    return new;
  end if;

  if coalesce(new.data->>'remainingQty','') ~ '^[-+]?[0-9]*\.?[0-9]+$' then
    v_qty := (new.data->>'remainingQty')::numeric;
  elsif coalesce(new.data->>'qty','') ~ '^[-+]?[0-9]*\.?[0-9]+$' then
    v_qty := (new.data->>'qty')::numeric;
  end if;

  if v_qty <= 0 then
    return new;
  end if;

  v_pn := trim(coalesce(new.data->>'pn',''));
  v_desc := coalesce(nullif(trim(new.data->>'description'),''), nullif(v_pn,''), 'Purchased part');
  v_vendor := coalesce(new.data->>'vendor','');
  v_system := coalesce(nullif(new.data->>'system',''),'General');
  v_location := coalesce(new.data->>'location','');
  v_unit_price := coalesce(new.data->>'unitPrice','');
  v_ship_date := coalesce(new.data->>'shipDate','');
  v_project_id := nullif(new.data->>'projectId','');

  v_lock_key := new.workspace_id::text || '|' ||
                lower(coalesce(nullif(v_pn,''), v_desc));
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key,0));

  select tr.record_id, tr.data
    into v_part_record_id, v_part_data
  from public.tracker_records tr
  where tr.workspace_id = new.workspace_id
    and tr.record_type = 'part'
    and tr.deleted_at is null
    and (
      (v_pn <> '' and lower(coalesce(tr.data->>'partNo','')) = lower(v_pn))
      or
      (v_pn = '' and lower(coalesce(tr.data->>'name','')) = lower(v_desc))
    )
  order by tr.updated_at desc nulls last
  limit 1;

  if v_part_record_id is not null then
    if coalesce(v_part_data->>'stockQty','') ~ '^[-+]?[0-9]*\.?[0-9]+$' then
      v_existing_qty := (v_part_data->>'stockQty')::numeric;
    else
      v_existing_qty := 0;
    end if;

    v_part_data := v_part_data || jsonb_build_object(
      'stockQty', v_existing_qty + v_qty,
      'status', coalesce(nullif(v_part_data->>'status',''),'On Hand'),
      'partNo', coalesce(nullif(v_part_data->>'partNo',''), v_pn),
      'name', coalesce(nullif(v_part_data->>'name',''), v_desc),
      'description', coalesce(nullif(v_part_data->>'description',''), v_desc),
      'vendor', coalesce(nullif(v_part_data->>'vendor',''), v_vendor),
      'system', coalesce(nullif(v_part_data->>'system',''), v_system),
      'location', coalesce(nullif(v_part_data->>'location',''), v_location),
      'unitCost', coalesce(nullif(v_part_data->>'unitCost',''), v_unit_price),
      'purchaseDate', coalesce(nullif(v_part_data->>'purchaseDate',''), v_ship_date)
    );

    update public.tracker_records
       set data = v_part_data,
           updated_at = clock_timestamp(),
           updated_by = new.updated_by,
           updated_client = 'db-inventory-sync'
     where workspace_id = new.workspace_id
       and record_type = 'part'
       and record_id = v_part_record_id;
  else
    v_new_part_id := floor(extract(epoch from clock_timestamp()) * 1000000)::bigint;
    v_part_record_id := v_new_part_id::text;
    v_part_data := jsonb_build_object(
      'id', v_new_part_id,
      'name', v_desc,
      'description', v_desc,
      'partNo', v_pn,
      'system', v_system,
      'partType', 'Inventory',
      'unit', 'ea',
      'stockQty', v_qty,
      'minQty', '',
      'status', 'On Hand',
      'vendor', v_vendor,
      'url', '',
      'unitCost', v_unit_price,
      'location', v_location,
      'purchaseDate', v_ship_date,
      'notes', concat('Created automatically from purchase reconciliation', case when coalesce(new.data->>'invoice','') <> '' then ' • invoice ' || (new.data->>'invoice') else '' end, '.'),
      'linkedProjectIds', case when v_project_id is not null and v_project_id ~ '^[0-9]+$' then jsonb_build_array(v_project_id::bigint) else '[]'::jsonb end,
      'updates', '[]'::jsonb
    );

    insert into public.tracker_records(workspace_id,record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client)
    values(new.workspace_id,'part',v_part_record_id,v_part_data,null,clock_timestamp(),new.updated_by,'db-inventory-sync')
    on conflict (workspace_id,record_type,record_id) do nothing;
  end if;

  new.data := new.data || jsonb_build_object(
    'inventoryPartId', v_part_record_id,
    'inventoryApplied', true,
    'remainingQty', v_qty
  );
  return new;
end;
$$;
