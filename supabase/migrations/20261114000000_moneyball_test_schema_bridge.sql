-- Isolated MONEYBALL test schema bridge. Additive only; legacy fields and data are retained.
alter table public.scan_runs add column if not exists owner_id uuid default auth.uid();
alter table public.scan_runs add column if not exists scan_date date default (now() at time zone 'Europe/Brussels')::date;
alter table public.scan_runs add column if not exists completed_at timestamptz;
alter table public.scan_runs add column if not exists status text default 'completed';
alter table public.scan_runs add column if not exists matches_found integer default 0;

alter table public.matches add column if not exists owner_id uuid default auth.uid();
alter table public.matches add column if not exists source text default 'FootyNomad';
alter table public.matches add column if not exists competition text;
alter table public.matches add column if not exists gender text default 'unknown';
alter table public.matches add column if not exists updated_at timestamptz default now();
alter table public.matches add column if not exists kickoff_date date;

alter table public.predictions add column if not exists owner_id uuid default auth.uid();
alter table public.predictions add column if not exists model_version text default 'MONEYBALL GLOBAL 3.8';
alter table public.predictions add column if not exists market text;
alter table public.predictions add column if not exists selection text;
alter table public.predictions add column if not exists verdict text default 'ODRZUCONY';
alter table public.predictions add column if not exists rationale text;
alter table public.predictions add column if not exists group_name text default 'MAIN';
alter table public.predictions add column if not exists settlement_status text default 'pending';
alter table public.predictions add column if not exists verified boolean default false;
alter table public.predictions add column if not exists note text;
alter table public.predictions add column if not exists data_source text;
alter table public.predictions add column if not exists data_coverage jsonb default '{}'::jsonb;
alter table public.predictions add column if not exists stake numeric(10,2) default 5.00;
alter table public.predictions add column if not exists potential_return numeric(12,2);
alter table public.predictions add column if not exists profit_loss numeric(12,2);

alter table public.coupons add column if not exists owner_id uuid default auth.uid();
alter table public.coupons add column if not exists scan_run_id uuid;
alter table public.coupons add column if not exists coupon_type text default 'MAIN';
alter table public.coupons add column if not exists target_legs integer default 3;
alter table public.coupons add column if not exists combined_odds numeric(12,2);
alter table public.coupons add column if not exists potential_return numeric(12,2);

alter table public.coupon_legs add column if not exists owner_id uuid default auth.uid();
alter table public.coupon_legs add column if not exists leg_number integer default 1;
alter table public.coupon_legs add column if not exists status text default 'pending';

alter table public.match_results add column if not exists owner_id uuid default auth.uid();
alter table public.match_results add column if not exists home_score integer;
alter table public.match_results add column if not exists away_score integer;
alter table public.match_results add column if not exists verified boolean default false;
alter table public.match_results add column if not exists finished_at timestamptz;
alter table public.match_results add column if not exists verified_at timestamptz;

alter table public.odds_snapshots add column if not exists owner_id uuid default auth.uid();
alter table public.odds_snapshots add column if not exists prediction_id uuid;
alter table public.odds_snapshots add column if not exists odds numeric(10,4);
alter table public.odds_snapshots add column if not exists source_url text;

alter table public.bankroll_transactions add column if not exists owner_id uuid default auth.uid();
alter table public.bankroll_transactions add column if not exists transaction_type text default 'adjustment';
alter table public.bankroll_transactions add column if not exists balance_after numeric(12,2);

update public.scan_runs set owner_id=coalesce(owner_id,user_id,auth.uid()), scan_date=coalesce(scan_date,(started_at at time zone 'Europe/Brussels')::date,(now() at time zone 'Europe/Brussels')::date), matches_found=coalesce(matches_found,matches_count,0), status=coalesce(status,'completed');
update public.matches set owner_id=coalesce(owner_id,user_id,auth.uid()), competition=coalesce(competition,league), source=coalesce(source,'FootyNomad'), gender=coalesce(gender,'unknown'), updated_at=coalesce(updated_at,created_at,now()), kickoff_date=coalesce(kickoff_date,(kickoff_at at time zone 'Europe/Brussels')::date);
update public.predictions set owner_id=coalesce(owner_id,user_id,auth.uid()), market=coalesce(market,case when prediction_type='DC' then 'DOUBLE_CHANCE' else prediction_type end,'1X2'), selection=coalesce(selection,pick,'—'), verdict=coalesce(verdict,selection_status,'ODRZUCONY'), settlement_status=coalesce(settlement_status,result_status,'pending'), rationale=coalesce(rationale,rejection_reason), note=coalesce(note,notes), stake=coalesce(stake,5), data_coverage=coalesce(data_coverage,'{}'::jsonb), verified=coalesce(verified,false);
update public.coupons set owner_id=coalesce(owner_id,user_id,auth.uid()), combined_odds=coalesce(combined_odds,total_odds), target_legs=coalesce(target_legs,3), coupon_type=coalesce(coupon_type,'MAIN');
update public.coupon_legs set owner_id=coalesce(owner_id,user_id,auth.uid()), status=coalesce(status,result_status,'pending');
update public.match_results set owner_id=coalesce(owner_id,user_id,auth.uid()), home_score=coalesce(home_score,home_goals), away_score=coalesce(away_score,away_goals), finished_at=coalesce(finished_at,settled_at), verified=coalesce(verified,false);
update public.odds_snapshots set owner_id=coalesce(owner_id,user_id,auth.uid());
update public.bankroll_transactions set owner_id=coalesce(owner_id,user_id,auth.uid()), transaction_type=coalesce(transaction_type,case when type='payout' then 'return' else type end,'adjustment');

alter table public.predictions alter column prediction_type drop not null;
alter table public.predictions alter column pick drop not null;
alter table public.coupon_legs alter column match_id drop not null;
alter table public.coupon_legs alter column prediction_type drop not null;
alter table public.coupon_legs alter column pick drop not null;
alter table public.odds_snapshots alter column match_id drop not null;
alter table public.bankroll_transactions alter column type drop not null;

create or replace function public.moneyball_test_compat()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare p record;
begin
 if tg_table_name='scan_runs' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   new.scan_date:=coalesce(new.scan_date,(new.started_at at time zone 'Europe/Brussels')::date,(now() at time zone 'Europe/Brussels')::date);
   new.matches_found:=coalesce(new.matches_found,new.matches_count,0); new.matches_count:=new.matches_found;
   new.status:=coalesce(new.status,'completed');
 elsif tg_table_name='matches' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   new.competition:=coalesce(new.competition,new.league); new.league:=coalesce(new.league,new.competition);
   new.source:=coalesce(new.source,'FootyNomad'); new.gender:=coalesce(new.gender,'unknown'); new.updated_at:=now();
   if new.kickoff_at is not null then new.kickoff_date:=(new.kickoff_at at time zone 'Europe/Brussels')::date; end if;
 elsif tg_table_name='predictions' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   new.market:=coalesce(new.market,case when new.prediction_type='DC' then 'DOUBLE_CHANCE' else new.prediction_type end,'1X2');
   new.prediction_type:=coalesce(new.prediction_type,case when new.market='DOUBLE_CHANCE' then 'DC' else new.market end);
   new.selection:=coalesce(new.selection,new.pick,'—'); new.pick:=coalesce(new.pick,new.selection);
   new.verdict:=coalesce(new.verdict,new.selection_status,'ODRZUCONY'); new.selection_status:=new.verdict;
   new.settlement_status:=coalesce(new.settlement_status,new.result_status,'pending'); new.result_status:=new.settlement_status;
   new.rationale:=coalesce(new.rationale,new.rejection_reason); new.rejection_reason:=coalesce(new.rejection_reason,new.rationale);
   new.note:=coalesce(new.note,new.notes); new.notes:=coalesce(new.notes,new.note);
   new.model_version:=coalesce(new.model_version,'MONEYBALL GLOBAL 3.8'); new.group_name:=coalesce(new.group_name,'MAIN');
   new.data_coverage:=coalesce(new.data_coverage,'{}'::jsonb); new.stake:=coalesce(new.stake,5); new.verified:=coalesce(new.verified,false);
 elsif tg_table_name='coupons' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid()); new.coupon_type:=coalesce(new.coupon_type,'MAIN');
   new.target_legs:=coalesce(new.target_legs,3); new.combined_odds:=coalesce(new.combined_odds,new.total_odds);
   new.total_odds:=coalesce(new.total_odds,new.combined_odds);
 elsif tg_table_name='coupon_legs' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   if new.prediction_id is not null then
     select match_id,market,prediction_type,selection,pick,probability,odds into p from public.predictions where id=new.prediction_id;
     if found then
       new.match_id:=coalesce(new.match_id,p.match_id);
       new.prediction_type:=coalesce(new.prediction_type,case when p.market='DOUBLE_CHANCE' then 'DC' else p.market end,p.prediction_type);
       new.pick:=coalesce(new.pick,p.selection,p.pick); new.probability:=coalesce(new.probability,p.probability); new.odds:=coalesce(new.odds,p.odds);
     end if;
   end if;
   if new.leg_number is null then select coalesce(max(leg_number),0)+1 into new.leg_number from public.coupon_legs where coupon_id=new.coupon_id; end if;
   new.status:=coalesce(new.status,new.result_status,'pending'); new.result_status:=new.status;
 elsif tg_table_name='match_results' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   new.home_score:=coalesce(new.home_score,new.home_goals); new.home_goals:=coalesce(new.home_goals,new.home_score);
   new.away_score:=coalesce(new.away_score,new.away_goals); new.away_goals:=coalesce(new.away_goals,new.away_score);
   new.finished_at:=coalesce(new.finished_at,new.settled_at,now());
 elsif tg_table_name='odds_snapshots' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
 elsif tg_table_name='bankroll_transactions' then
   new.owner_id:=coalesce(new.owner_id,new.user_id,auth.uid());
   new.transaction_type:=coalesce(new.transaction_type,case when new.type='payout' then 'return' else new.type end,'adjustment');
   new.type:=coalesce(new.type,case when new.transaction_type='return' then 'payout' else new.transaction_type end);
 end if;
 return new;
end $$;

drop trigger if exists moneyball_test_compat on public.scan_runs;
create trigger moneyball_test_compat before insert or update on public.scan_runs for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.matches;
create trigger moneyball_test_compat before insert or update on public.matches for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.predictions;
create trigger moneyball_test_compat before insert or update on public.predictions for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.coupons;
create trigger moneyball_test_compat before insert or update on public.coupons for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.coupon_legs;
create trigger moneyball_test_compat before insert or update on public.coupon_legs for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.match_results;
create trigger moneyball_test_compat before insert or update on public.match_results for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.odds_snapshots;
create trigger moneyball_test_compat before insert or update on public.odds_snapshots for each row execute function public.moneyball_test_compat();
drop trigger if exists moneyball_test_compat on public.bankroll_transactions;
create trigger moneyball_test_compat before insert or update on public.bankroll_transactions for each row execute function public.moneyball_test_compat();

create unique index if not exists moneyball_test_predictions_identity_idx on public.predictions(owner_id,match_id,model_version,market,selection);
create index if not exists moneyball_test_matches_owner_id_idx on public.matches(owner_id,id);
create index if not exists moneyball_test_predictions_owner_id_idx on public.predictions(owner_id,id);
create index if not exists moneyball_test_scan_runs_owner_id_idx on public.scan_runs(owner_id,id);

do $$
declare t text;
begin
 foreach t in array array['scan_runs','matches','predictions','coupons','coupon_legs','match_results','odds_snapshots','bankroll_transactions'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('drop policy if exists moneyball_test_owner_all on public.%I',t);
   execute format('create policy moneyball_test_owner_all on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',t);
   execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
