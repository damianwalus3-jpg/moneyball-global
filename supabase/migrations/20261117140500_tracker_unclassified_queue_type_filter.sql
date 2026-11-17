-- Filter the unclassified queue by entity type before applying pagination.
drop function if exists public.moneyball_tracker_unclassified_page(integer, integer);
create function public.moneyball_tracker_unclassified_page(
  p_entity_type text default null,
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
  if p_entity_type is not null and p_entity_type not in ('prediction', 'coupon') then
    raise exception 'Invalid entity type';
  end if;
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
        and (p_entity_type is null or p_entity_type = 'prediction')
      union all
      select 'coupon'::text, c.id,
        coalesce(nullif(c.name, ''), c.coupon_type),
        concat(c.coupon_type, ' · ', c.status, ' · ', coalesce(c.target_legs::text, '—'), ' nóg'),
        c.created_at
      from public.coupons c
      where c.owner_id = v_owner and c.source_class is null
        and (p_entity_type is null or p_entity_type = 'coupon')
    ) q
    order by q.created_at desc, q.entity_type, q.entity_id
    limit p_limit offset p_offset;
end;
$$;
revoke all on function public.moneyball_tracker_unclassified_page(text, integer, integer) from public, anon;
grant execute on function public.moneyball_tracker_unclassified_page(text, integer, integer) to authenticated;
