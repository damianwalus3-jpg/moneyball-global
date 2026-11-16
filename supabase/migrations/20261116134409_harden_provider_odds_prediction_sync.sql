create or replace function public.apply_provider_odds_to_matching_predictions()
returns trigger language plpgsql security definer set search_path=public as $$ declare
  v_latest public.provider_odds%rowtype;
begin
  if new.mapped_market is null or new.mapped_selection is null or new.owner_id is null or new.match_id is null then return new; end if;
  select po.* into v_latest from public.provider_odds po
  where po.owner_id = new.owner_id and po.match_id = new.match_id
    and po.mapped_market = new.mapped_market and po.mapped_selection = new.mapped_selection
    and po.suspended = false and lower(coalesce(po.phase, 'prematch')) = 'prematch'
    and po.odds > 1 and po.captured_at >= now() - interval '6 hours'
    and po.captured_at <= now() + interval '2 minutes'
  order by po.captured_at desc, po.price_timestamp desc nulls last, po.id desc limit 1;
  if found then
    update public.predictions p set odds = v_latest.odds,
      data_source = coalesce(v_latest.provider, 'provider') || '/' || coalesce(v_latest.bookmaker, 'bookmaker'),
      data_coverage = coalesce(p.data_coverage, '{}'::jsonb) || jsonb_build_object(
        'odds_status','CONFIRMED','odds_source',v_latest.provider,'odds_bookmaker',v_latest.bookmaker,
        'odds_captured_at',v_latest.captured_at,'odds_price_timestamp',v_latest.price_timestamp,
        'odds_phase',v_latest.phase,'odds_suspended',false)
    where p.match_id=v_latest.match_id and coalesce(p.owner_id,p.user_id)=v_latest.owner_id
      and p.market=v_latest.mapped_market and coalesce(p.selection,p.pick)=v_latest.mapped_selection
      and coalesce(p.data_coverage->>'odds_source','') <> 'manual'
      and coalesce(p.data_source,'') not ilike '%Bwin%';
  else
    update public.predictions p set odds=null,
      data_coverage=coalesce(p.data_coverage,'{}'::jsonb)||jsonb_build_object(
        'odds_status',case when new.suspended then 'SUSPENDED' else 'STALE' end,
        'odds_source',new.provider,'odds_bookmaker',new.bookmaker,
        'odds_captured_at',new.captured_at,'odds_phase',new.phase,'odds_suspended',new.suspended)
    where p.match_id=new.match_id and coalesce(p.owner_id,p.user_id)=new.owner_id
      and p.market=new.mapped_market and coalesce(p.selection,p.pick)=new.mapped_selection
      and coalesce(p.data_coverage->>'odds_source','') <> 'manual'
      and (p.data_coverage->>'odds_source'=new.provider or p.data_coverage->>'odds_source'='MoviOdds')
      and coalesce(p.data_source,'') not ilike '%Bwin%';
  end if;
  return new;
end; $$;
create or replace function public.apply_provider_odds_to_predictions()
returns trigger language plpgsql security definer set search_path=public as $$ declare
  v_latest public.provider_odds%rowtype;
begin
  if new.mapped_market is null or new.mapped_selection is null or new.owner_id is null or new.match_id is null then return new; end if;
  select po.* into v_latest from public.provider_odds po
  where po.owner_id = new.owner_id and po.match_id = new.match_id
    and po.mapped_market = new.mapped_market and po.mapped_selection = new.mapped_selection
    and po.suspended = false and lower(coalesce(po.phase, 'prematch')) = 'prematch'
    and po.odds > 1 and po.captured_at >= now() - interval '6 hours'
    and po.captured_at <= now() + interval '2 minutes'
  order by po.captured_at desc, po.price_timestamp desc nulls last, po.id desc limit 1;
  if found then
    update public.predictions p set odds = v_latest.odds,
      data_source = coalesce(v_latest.provider, 'provider') || '/' || coalesce(v_latest.bookmaker, 'bookmaker'),
      data_coverage = coalesce(p.data_coverage, '{}'::jsonb) || jsonb_build_object(
        'odds_status','CONFIRMED','odds_source',v_latest.provider,'odds_bookmaker',v_latest.bookmaker,
        'odds_captured_at',v_latest.captured_at,'odds_price_timestamp',v_latest.price_timestamp,
        'odds_phase',v_latest.phase,'odds_suspended',false)
    where p.match_id=v_latest.match_id and coalesce(p.owner_id,p.user_id)=v_latest.owner_id
      and p.market=v_latest.mapped_market and coalesce(p.selection,p.pick)=v_latest.mapped_selection
      and coalesce(p.data_coverage->>'odds_source','') <> 'manual'
      and coalesce(p.data_source,'') not ilike '%Bwin%';
  else
    update public.predictions p set odds=null,
      data_coverage=coalesce(p.data_coverage,'{}'::jsonb)||jsonb_build_object(
        'odds_status',case when new.suspended then 'SUSPENDED' else 'STALE' end,
        'odds_source',new.provider,'odds_bookmaker',new.bookmaker,
        'odds_captured_at',new.captured_at,'odds_phase',new.phase,'odds_suspended',new.suspended)
    where p.match_id=new.match_id and coalesce(p.owner_id,p.user_id)=new.owner_id
      and p.market=new.mapped_market and coalesce(p.selection,p.pick)=new.mapped_selection
      and coalesce(p.data_coverage->>'odds_source','') <> 'manual'
      and (p.data_coverage->>'odds_source'=new.provider or p.data_coverage->>'odds_source'='MoviOdds')
      and coalesce(p.data_source,'') not ilike '%Bwin%';
  end if;
  return new;
end; $$;
revoke all on function public.apply_provider_odds_to_matching_predictions() from public, anon, authenticated;
revoke all on function public.apply_provider_odds_to_predictions() from public, anon, authenticated;
grant execute on function public.apply_provider_odds_to_matching_predictions() to service_role;
grant execute on function public.apply_provider_odds_to_predictions() to service_role;