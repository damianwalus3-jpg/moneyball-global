-- Preserve user-entered bookmaker prices when automated quotes are refreshed.
create or replace function public.apply_latest_provider_odds_to_prediction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_odds numeric;
  v_bookmaker text;
  v_provider text;
  v_captured_at timestamptz;
  v_suspended boolean;
  v_owner_id uuid;
begin
  v_owner_id := coalesce(new.owner_id, new.user_id);

  if coalesce(new.data_source, '') ilike '%Bwin%'
     or coalesce(new.data_coverage->>'odds_source','') = 'manual' then
    return new;
  end if;

  select o.odds, o.bookmaker, o.provider, o.captured_at, o.suspended
    into v_odds, v_bookmaker, v_provider, v_captured_at, v_suspended
  from public.provider_odds o
  where o.match_id = new.match_id
    and o.owner_id = v_owner_id
    and o.mapped_market = new.market
    and o.mapped_selection = coalesce(new.selection, new.pick)
    and o.suspended = false
    and o.odds > 1
    and o.phase = 'prematch'
    and o.captured_at >= now() - interval '6 hours'
  order by o.captured_at desc
  limit 1;

  if v_odds is not null then
    new.odds := v_odds;
    new.data_source := coalesce(v_provider, 'MoviOdds') || '/' || coalesce(v_bookmaker, 'bookmaker');
    new.data_coverage := coalesce(new.data_coverage, '{}'::jsonb)
      || jsonb_build_object(
        'odds_source', coalesce(v_provider, 'MoviOdds'),
        'odds_bookmaker', coalesce(v_bookmaker, 'bookmaker'),
        'odds_captured_at', v_captured_at,
        'odds_suspended', coalesce(v_suspended, false)
      );
  end if;
  return new;
end;
$$;

create or replace function public.apply_provider_odds_to_matching_predictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.suspended is not false
     or new.phase <> 'prematch'
     or new.odds is null or new.odds <= 1
     or new.mapped_market is null or new.mapped_selection is null
     or new.captured_at < now() - interval '6 hours'
     or new.owner_id is null or new.match_id is null then
    return new;
  end if;

  update public.predictions p
  set odds = new.odds,
      data_source = coalesce(new.provider, 'provider') || '/' || coalesce(new.bookmaker, 'bookmaker'),
      data_coverage = coalesce(p.data_coverage, '{}'::jsonb)
        || jsonb_build_object(
          'odds_source', coalesce(new.provider, 'provider'),
          'odds_bookmaker', coalesce(new.bookmaker, 'bookmaker'),
          'odds_captured_at', new.captured_at,
          'odds_suspended', false
        )
  where p.match_id = new.match_id
    and coalesce(p.owner_id, p.user_id) = new.owner_id
    and p.market = new.mapped_market
    and coalesce(p.selection, p.pick) = new.mapped_selection
    and coalesce(p.data_source, '') not ilike '%Bwin%'
    and coalesce(p.data_coverage->>'odds_source','') <> 'manual'
    and (p.odds is null or coalesce((p.data_coverage->>'odds_captured_at')::timestamptz, 'epoch'::timestamptz) <= new.captured_at);

  return new;
end;
$$;

revoke all on function public.apply_latest_provider_odds_to_prediction() from public, anon, authenticated;
revoke all on function public.apply_provider_odds_to_matching_predictions() from public, anon, authenticated;