-- Return only newly inserted audit records during idempotent backup restore.
create or replace function public.moneyball_tracker_restore_source_audit(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_row jsonb;
  v_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_new_class text;
  v_changed_by uuid;
  v_changed_at timestamptz;
  v_rows integer := 0;
  v_total integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Audit restore accepts an array of at most 500 rows';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := (v_row->>'id')::uuid;
    v_entity_type := v_row->>'entity_type';
    v_entity_id := (v_row->>'entity_id')::uuid;
    v_new_class := v_row->>'new_source_class';
    v_changed_by := (v_row->>'changed_by')::uuid;
    v_changed_at := (v_row->>'changed_at')::timestamptz;
    if v_entity_type not in ('prediction', 'coupon')
      or v_new_class not in ('USER', 'MODEL', 'PAPER')
      or v_changed_by <> v_owner
      or v_id is null or v_entity_id is null or v_changed_at is null then
      raise exception 'Invalid audit backup row';
    end if;
    insert into public.moneyball_tracker_source_audit
      (id, owner_id, entity_type, entity_id, previous_source_class, new_source_class, note, changed_by, changed_at)
    values (
      v_id, v_owner, v_entity_type, v_entity_id, v_row->>'previous_source_class',
      v_new_class, nullif(v_row->>'note', ''), v_owner, v_changed_at
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
