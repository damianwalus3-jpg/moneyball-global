create table if not exists public.provider_odds (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 match_id uuid not null references public.matches(id) on delete cascade,
 provider text not null default 'MoviOdds',
 provider_fixture_id text not null,
 bookmaker text not null default 'bet365',
 sport text not null default 'soccer',
 market_group_id text not null,
 market_id text not null default '',
 market_name text not null,
 selection_id text not null,
 selection_label text,
 selection_side text,
 selection_line text,
 selection_handicap text,
 odds numeric(10,4) not null check (odds > 1),
 suspended boolean not null default false,
 phase text not null default 'prematch',
 price_timestamp timestamptz,
 provider_polled_at timestamptz,
 captured_at timestamptz not null default now(),
 raw_quote jsonb not null default '{}'::jsonb,
 mapped_market text,
 mapped_selection text,
 unique(provider, provider_fixture_id, market_group_id, market_id, selection_id)
);
create index if not exists provider_odds_match_market_idx on public.provider_odds(match_id, market_name, captured_at desc);
create index if not exists provider_odds_fixture_idx on public.provider_odds(provider_fixture_id);
create index if not exists provider_odds_fresh_idx on public.provider_odds(captured_at desc) where suspended=false;
alter table public.provider_odds enable row level security;
drop policy if exists provider_odds_owner_read on public.provider_odds;
create policy provider_odds_owner_read on public.provider_odds for select to authenticated using (owner_id = auth.uid());
grant select on public.provider_odds to authenticated;
grant all on public.provider_odds to service_role;
create or replace function public.apply_provider_odds_to_predictions() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.mapped_market is not null and new.mapped_selection is not null then
  update public.predictions p
  set odds=new.odds, data_source='MoviOdds/bet365',
      data_coverage=coalesce(p.data_coverage,'{}'::jsonb)||jsonb_build_object('odds_source','MoviOdds','odds_captured_at',new.captured_at,'odds_suspended',new.suspended)
  where p.match_id=new.match_id and p.market=new.mapped_market and coalesce(p.selection,p.pick)=new.mapped_selection;
 end if;
 return new;
end $$;
drop trigger if exists trg_apply_provider_odds_to_predictions on public.provider_odds;
create trigger trg_apply_provider_odds_to_predictions after insert or update of odds,captured_at,suspended,mapped_market,mapped_selection on public.provider_odds for each row execute function public.apply_provider_odds_to_predictions();
