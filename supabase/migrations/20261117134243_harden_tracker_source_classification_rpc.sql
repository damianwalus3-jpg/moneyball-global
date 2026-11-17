-- Harden Tracker SECURITY DEFINER RPCs and validate audit restore ownership.
create or replace function public.moneyball_tracker_classify_source(
  p_entity_type text,
  p_entity_ids uuid[],
  p_source_class text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_changed integer := 0;
  v_id uuid;
  v_previous text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_entity_type is null or p_entity_type not in ('prediction', 'coupon') then raise exception 'Invalid entity type'; end if;
  if p_source_class is null or p_source_class not in ('USER', 'MODEL', 'PAPER') then raise exception 'Invalid source class'; end if;
  if p_entity_ids is null or pg_catalog.cardinality(p_entity_ids) < 1 or pg_catalog.cardinality(p_entity_ids) > 100 then
    raise exception 'Select between 1 and 100 records';
  end if;
  if pg_catalog.cardinality(p_entity_ids) <> (
    select count(distinct ids.id) from pg_catalog.unnest(p_entity_ids) as ids(id)
  ) then raise exception 'Duplicate or null record IDs'; end if;
  if pg_catalog.length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

  foreach v_id in array p_entity_ids loop
    if p_entity_type = 'prediction' then
      select p.source_class into v_previous
      from public.predictions p where p.id = v_id and p.owner_id = v_owner for update;
      if not found or v_previous is not null then raise exception 'Record missing or already classified: %', v_id; end if;
      update public.predictions p set source_class = p_source_class
        where p.id = v_id and p.owner_id = v_owner and p.source_class is null;
    else
      select c.source_class into v_previous
      from public.coupons c where c.id = v_id and c.owner_id = v_owner for update;
      if not found or v_previous is not null then raise exception 'Record missing or already classified: %', v_id; end if;
      update public.coupons c set source_class = p_source_class
        where c.id = v_id and c.owner_id = v_owner and c.source_class is null;
    end if;
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'Concurrent classification conflict: %', v_id; end if;
    insert into public.moneyball_tracker_source_audit
      (owner_id, entity_type, entity_id, previous_source_class, new_source_class, note, changed_by)
    values (v_owner, p_entity_type, v_id, null, p_source_class, nullif(pg_catalog.btrim(p_note), ''), v_owner);
  end loop;
  return pg_catalog.cardinality(p_entity_ids);
end;
$$;
revoke all on function public.moneyball_tracker_classify_source(text, uuid[], text, text) from public, anon;
grant execute on function public.moneyball_tracker_classify_source(text, uuid[], text, text) to authenticated;

create or replace function public.moneyball_tracker_restore_source_audit(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row jsonb;
  v_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_new_class text;
  v_previous_class text;
  v_changed_by uuid;
  v_changed_at timestamptz;
  v_note text;
  v_rows integer := 0;
  v_total integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' or pg_catalog.jsonb_array_length(p_rows) > 500 then
    raise exception 'Audit restore accepts an array of at most 500 rows';
  end if;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    if pg_catalog.jsonb_typeof(v_row) <> 'object' then raise exception 'Invalid audit backup row'; end if;
    v_id := (v_row->>'id')::uuid;
    v_entity_type := v_row->>'entity_type';
    v_entity_id := (v_row->>'entity_id')::uuid;
    v_new_class := v_row->>'new_source_class';
    v_previous_class := v_row->>'previous_source_class';
    v_changed_by := (v_row->>'changed_by')::uuid;
    v_changed_at := (v_row->>'changed_at')::timestamptz;
    v_note := v_row->>'note';

    if v_entity_type is null or v_entity_type not in ('prediction', 'coupon')
      or v_new_class is null or v_new_class not in ('USER', 'MODEL', 'PAPER')
      or (v_previous_class is not null and v_previous_class not in ('USER', 'MODEL', 'PAPER'))
      or v_changed_by is distinct from v_owner
      or v_id is null or v_entity_id is null or v_changed_at is null
      or pg_catalog.length(coalesce(v_note, '')) > 500 then
      raise exception 'Invalid audit backup row';
    end if;

    if v_entity_type = 'prediction' then
      if not exists (select 1 from public.predictions p where p.id = v_entity_id and p.owner_id = v_owner) then
        raise exception 'Audit prediction does not belong to authenticated owner';
      end if;
    else
      if not exists (select 1 from public.coupons c where c.id = v_entity_id and c.owner_id = v_owner) then
        raise exception 'Audit coupon does not belong to authenticated owner';
      end if;
    end if;

    insert into public.moneyball_tracker_source_audit
      (id, owner_id, entity_type, entity_id, previous_source_class, new_source_class, note, changed_by, changed_at)
    values (
      v_id, v_owner, v_entity_type, v_entity_id, v_previous_class,
      v_new_class, nullif(pg_catalog.btrim(v_note), ''), v_owner, v_changed_at
    )
    on conflict (id) do nothing;
    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.moneyball_tracker_restore_source_audit(jsonb) from public, anon;
grant execute on function public.moneyball_tracker_restore_source_audit(jsonb) to authenticated;
