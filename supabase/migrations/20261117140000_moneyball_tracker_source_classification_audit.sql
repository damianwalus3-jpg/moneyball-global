-- Audited, explicit source classification for selected legacy Tracker rows.
create table if not exists public.moneyball_tracker_source_audit (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entity_type text not null check (entity_type in ('prediction', 'coupon')),
  entity_id uuid not null,
  previous_source_class text,
  new_source_class text not null check (new_source_class in ('USER', 'MODEL', 'PAPER')),
  note text,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);

create index if not exists moneyball_tracker_source_audit_owner_changed_idx
  on public.moneyball_tracker_source_audit(owner_id, changed_at desc);

alter table public.moneyball_tracker_source_audit enable row level security;
drop policy if exists moneyball_tracker_source_audit_select on public.moneyball_tracker_source_audit;
create policy moneyball_tracker_source_audit_select
  on public.moneyball_tracker_source_audit for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.moneyball_tracker_source_audit from anon, authenticated;
grant select on public.moneyball_tracker_source_audit to authenticated;

create index if not exists predictions_unclassified_owner_created_idx
  on public.predictions(owner_id, created_at desc, id desc)
  where source_class is null;
create index if not exists coupons_unclassified_owner_created_idx
  on public.coupons(owner_id, created_at desc, id desc)
  where source_class is null;

create or replace function public.moneyball_tracker_unclassified_page(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id uuid,
  label text,
  detail text,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 or p_offset > 1000000 then
    raise exception 'Invalid pagination';
  end if;

  return query
    select q.entity_type, q.entity_id, q.label, q.detail, q.created_at
    from (
      select 'prediction'::text as entity_type, p.id as entity_id,
        concat(coalesce(m.home_team, 'Nieznana drużyna'), ' — ', coalesce(m.away_team, 'Nieznana drużyna')) as label,
        concat(coalesce(p.market, '—'), ' · ', coalesce(p.selection, '—'), ' · ', coalesce(p.group_name, 'bez kategorii')) as detail,
        p.created_at
      from public.predictions p
      left join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
      where p.owner_id = v_owner and p.source_class is null
      union all
      select 'coupon'::text, c.id,
        coalesce(nullif(c.name, ''), c.coupon_type),
        concat(c.coupon_type, ' · ', c.status, ' · ', coalesce(c.target_legs::text, '—'), ' nóg'),
        c.created_at
      from public.coupons c
      where c.owner_id = v_owner and c.source_class is null
    ) q
    order by q.created_at desc, q.entity_type, q.entity_id
    limit p_limit offset p_offset;
end;
$$;
revoke all on function public.moneyball_tracker_unclassified_page(integer, integer) from public, anon;
grant execute on function public.moneyball_tracker_unclassified_page(integer, integer) to authenticated;

create or replace function public.moneyball_tracker_classify_source(
  p_entity_type text,
  p_entity_ids uuid[],
  p_source_class text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_changed integer := 0;
  v_id uuid;
  v_previous text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_entity_type not in ('prediction', 'coupon') then raise exception 'Invalid entity type'; end if;
  if p_source_class not in ('USER', 'MODEL', 'PAPER') then raise exception 'Invalid source class'; end if;
  if p_entity_ids is null or cardinality(p_entity_ids) < 1 or cardinality(p_entity_ids) > 100 then
    raise exception 'Select between 1 and 100 records';
  end if;
  if cardinality(p_entity_ids) <> (select count(distinct value) from unnest(p_entity_ids) as ids(value)) then
    raise exception 'Duplicate record IDs';
  end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

  foreach v_id in array p_entity_ids loop
    if p_entity_type = 'prediction' then
      select source_class into v_previous
      from public.predictions where id = v_id and owner_id = v_owner for update;
      if not found or v_previous is not null then raise exception 'Record missing or already classified: %', v_id; end if;
      update public.predictions set source_class = p_source_class
        where id = v_id and owner_id = v_owner and source_class is null;
    else
      select source_class into v_previous
      from public.coupons where id = v_id and owner_id = v_owner for update;
      if not found or v_previous is not null then raise exception 'Record missing or already classified: %', v_id; end if;
      update public.coupons set source_class = p_source_class
        where id = v_id and owner_id = v_owner and source_class is null;
    end if;
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'Concurrent classification conflict: %', v_id; end if;
    insert into public.moneyball_tracker_source_audit
      (owner_id, entity_type, entity_id, previous_source_class, new_source_class, note, changed_by)
    values (v_owner, p_entity_type, v_id, null, p_source_class, nullif(trim(p_note), ''), v_owner);
  end loop;
  return cardinality(p_entity_ids);
end;
$$;
revoke all on function public.moneyball_tracker_classify_source(text, uuid[], text, text) from public, anon;
grant execute on function public.moneyball_tracker_classify_source(text, uuid[], text, text) to authenticated;

comment on table public.moneyball_tracker_source_audit is
  'Append-only audit trail for explicit owner-confirmed classification of legacy prediction/coupon source_class values.';
