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
    and (p.odds is null or coalesce((p.data_coverage->>'odds_captured_at')::timestamptz, 'epoch'::timestamptz) <= new.captured_at);

  return new;
end;
$$;

drop trigger if exists trg_apply_provider_odds_to_matching_predictions on public.provider_odds;
create trigger trg_apply_provider_odds_to_matching_predictions
after insert or update of odds, suspended, phase, mapped_market, mapped_selection, captured_at
on public.provider_odds
for each row execute function public.apply_provider_odds_to_matching_predictions();

revoke all on function public.apply_provider_odds_to_matching_predictions() from public, anon, authenticated;

with latest_quotes as (
  select distinct on (o.owner_id, o.match_id, o.mapped_market, o.mapped_selection)
    o.owner_id, o.match_id, o.mapped_market, o.mapped_selection,
    o.odds, o.bookmaker, o.provider, o.captured_at
  from public.provider_odds o
  join public.matches m on m.id = o.match_id
  where o.suspended = false
    and o.phase = 'prematch'
    and o.odds > 1
    and o.mapped_market is not null
    and o.mapped_selection is not null
    and o.captured_at >= now() - interval '6 hours'
    and m.kickoff_at > now() - interval '2 hours'
  order by o.owner_id, o.match_id, o.mapped_market, o.mapped_selection, o.captured_at desc
)
update public.predictions p
set odds = q.odds,
    data_source = coalesce(q.provider, 'provider') || '/' || coalesce(q.bookmaker, 'bookmaker'),
    data_coverage = coalesce(p.data_coverage, '{}'::jsonb)
      || jsonb_build_object(
        'odds_source', coalesce(q.provider, 'provider'),
        'odds_bookmaker', coalesce(q.bookmaker, 'bookmaker'),
        'odds_captured_at', q.captured_at,
        'odds_suspended', false
      )
from latest_quotes q
where p.match_id = q.match_id
  and coalesce(p.owner_id, p.user_id) = q.owner_id
  and p.market = q.mapped_market
  and coalesce(p.selection, p.pick) = q.mapped_selection
  and coalesce(p.data_source, '') not ilike '%Bwin%'
  and (p.odds is null or coalesce((p.data_coverage->>'odds_captured_at')::timestamptz, 'epoch'::timestamptz) <= q.captured_at);