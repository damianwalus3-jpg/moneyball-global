-- Keep provider odds attached when the prediction engine inserts or refreshes rows.
-- Preserve explicitly sourced Bwin prices; never synthesize missing quotes.

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

  if v_odds is not null and coalesce(new.data_source, '') not ilike '%Bwin%' then
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

drop trigger if exists trg_apply_latest_provider_odds_to_prediction on public.predictions;
create trigger trg_apply_latest_provider_odds_to_prediction
before insert or update of match_id, market, selection, pick, user_id, owner_id
on public.predictions
for each row execute function public.apply_latest_provider_odds_to_prediction();

revoke all on function public.apply_latest_provider_odds_to_prediction() from public, anon, authenticated;

with latest_quotes as (
  select distinct on (o.owner_id, o.match_id, o.mapped_market, o.mapped_selection)
    o.owner_id, o.match_id, o.mapped_market, o.mapped_selection,
    o.odds, o.bookmaker, o.provider, o.captured_at, o.suspended
  from public.provider_odds o
  join public.matches m on m.id = o.match_id
  where o.suspended = false and o.odds > 1 and o.phase = 'prematch'
    and o.captured_at >= now() - interval '6 hours'
    and m.kickoff_at > now() - interval '2 hours'
    and o.mapped_market is not null and o.mapped_selection is not null
  order by o.owner_id, o.match_id, o.mapped_market, o.mapped_selection, o.captured_at desc
)
update public.predictions p
set odds = q.odds,
    data_source = coalesce(q.provider, 'MoviOdds') || '/' || coalesce(q.bookmaker, 'bookmaker'),
    data_coverage = coalesce(p.data_coverage, '{}'::jsonb)
      || jsonb_build_object(
        'odds_source', coalesce(q.provider, 'MoviOdds'),
        'odds_bookmaker', coalesce(q.bookmaker, 'bookmaker'),
        'odds_captured_at', q.captured_at,
        'odds_suspended', coalesce(q.suspended, false)
      )
from latest_quotes q
where p.match_id = q.match_id
  and coalesce(p.owner_id, p.user_id) = q.owner_id
  and p.market = q.mapped_market
  and coalesce(p.selection, p.pick) = q.mapped_selection
  and coalesce(p.data_source, '') not ilike '%Bwin%'
  and (p.odds is null or p.data_source is distinct from (coalesce(q.provider, 'MoviOdds') || '/' || coalesce(q.bookmaker, 'bookmaker')));
