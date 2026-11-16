-- Keep the dashboard's selected-picks feed in sync with the same European top-two league scope.
CREATE OR REPLACE FUNCTION public.moneyball_dashboard_selected_picks()
RETURNS TABLE (
  prediction_id uuid,
  market text,
  selection text,
  probability numeric,
  odds numeric,
  settlement_status text,
  match_id uuid,
  home_team text,
  away_team text,
  competition text,
  league text,
  kickoff_at timestamptz,
  kickoff_date date,
  match_status text,
  home_score integer,
  away_score integer,
  rationale text,
  confidence text,
  data_coverage jsonb
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    p.id, p.market, p.selection, p.probability, p.odds, p.settlement_status,
    m.id, m.home_team, m.away_team, m.competition, m.league, m.kickoff_at,
    m.kickoff_date, m.status, r.home_score, r.away_score,
    p.rationale, p.confidence, p.data_coverage
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  left join public.match_results r on r.match_id = m.id and r.owner_id = m.owner_id
  where p.owner_id = (select auth.uid())
    and m.owner_id = (select auth.uid())
    and (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and p.verdict = 'WYBRANY'
    and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
    and m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
    and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
  order by m.kickoff_at asc nulls last, p.created_at desc
  limit 100;
$function$;

REVOKE ALL ON FUNCTION public.moneyball_dashboard_selected_picks() FROM public;
GRANT EXECUTE ON FUNCTION public.moneyball_dashboard_selected_picks() TO authenticated;