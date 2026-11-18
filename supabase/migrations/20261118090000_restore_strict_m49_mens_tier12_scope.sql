-- Strict production boundary for MONEYBALL GLOBAL MAIN.
-- No historical rows, stakes, bankroll transactions or coupon settlements are rewritten.

CREATE OR REPLACE FUNCTION public.moneyball_is_geographic_europe_country(p_country text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM regexp_split_to_table(coalesce(p_country,''), '[,/;|]+') AS part(value)
    WHERE regexp_replace(normalize(lower(btrim(part.value)), NFD), '[^a-z0-9]+', '', 'g') = ANY (ARRAY[
      'albania','andorra','austria','alandislands','belarus','belgium','bosnia','bosniaandherzegovina','bosniaherzegovina',
      'bulgaria','croatia','czechia','czechrepublic','denmark','england','estonia','faroeislands','finland','france',
      'germany','gibraltar','greece','guernsey','hungary','iceland','ireland','republicofireland','isleofman','italy',
      'jersey','kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova','monaco','montenegro',
      'netherlands','northmacedonia','macedonia','northernireland','norway','poland','portugal','romania','russia',
      'russianfederation','sanmarino','scotland','serbia','slovakia','slovenia','spain','sweden','switzerland','ukraine',
      'wales','unitedkingdom','unitedkingdomofgreatbritainandnorthernireland','greatbritain','svalbardandjanmayen',
      'svalbardandjanmayenislands','holysee','vaticancity','alb','ala','and','aut','blr','bel','bih','bgr','bul','hrv',
      'cro','cze','dnk','eng','est','fro','fin','fra','deu','ger','gib','grc','gre','ggy','hun','isl','irl','imn','ita',
      'jey','kos','xkx','lva','lie','ltu','lux','mlt','mda','mco','mne','nld','mkd','nir','nor','pol','prt','por','rou',
      'rus','smr','srb','sco','svk','svn','esp','swe','che','sui','ukr','wal','gbr','gb','uk','vat','sjm'
    ])
  );
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text,p_competition text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE
  v_country text := regexp_replace(normalize(lower(btrim(coalesce(p_country,''))),NFD),'[^a-z0-9]+','','g');
  v_label text := regexp_replace(normalize(lower(btrim(coalesce(p_competition,''))),NFD),'[^a-z0-9]+',' ','g');
BEGIN
  IF v_label='' OR NOT public.moneyball_is_geographic_europe_country(p_country) THEN RETURN false; END IF;
  IF v_label ~* '(^| )(uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|friendly|qualifying|qualifier|cup|copa|coppa|coupe|pokal|trophy|shield|super cup|ta ca|kupa|kup|puchar|cupa|women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|ladies|girls|youth|academy|juniors|reserve|reserves|development league|professional development league|elite league|premier league 2|u[ ]*[0-9]{1,2}|under[ -]*[0-9]{1,2})( |$)' THEN RETURN false; END IF;
  IF v_country='england' AND v_label ~* '(^| )(league one|league two|national league|national league north|national league south|non league|istmian|southern league|northern premier)( |$)' THEN RETURN false; END IF;
  IF v_country='scotland' AND v_label ~* '(^| )(league one|league two|lowland league|highland league|lowland|highland)( |$)' THEN RETURN false; END IF;
  IF v_country='germany' AND v_label ~* '(^| )(regionalliga|oberliga|landesliga|verbandsliga)( |$)' THEN RETURN false; END IF;
  IF v_country='spain' AND v_label ~* '(^| )(primera federacion|segunda federacion|tercera federacion|tercera rfef|segunda rfef|tercera division)( |$)' THEN RETURN false; END IF;
  IF v_country='france' AND v_label ~* '(^| )(national 2|national 3|regional 1|regional 2)( |$)' THEN RETURN false; END IF;
  IF v_country='italy' AND v_label ~* '(^| )(serie c|serie d)( |$)' THEN RETURN false; END IF;
  IF v_country='sweden' AND v_label ~* '(^| )(division 1|division 2|division 3)( |$)' THEN RETURN false; END IF;
  IF v_country='denmark' AND v_label ~* '(^| )(2nd division|2 division|3 division)( |$)' THEN RETURN false; END IF;
  IF v_country='switzerland' AND v_label ~* '(^| )(1 liga|2 liga|2 liga interregional)( |$)' THEN RETURN false; END IF;
  IF v_country='poland' AND v_label ~* '(^| )(2 liga|iii liga|iv liga)( |$)' THEN RETURN false; END IF;
  IF v_country='croatia' AND v_label ~* '(^| )(second nl|third nl)( |$)' THEN RETURN false; END IF;
  IF v_country='estonia' AND v_label ~* '(^| )esiliiga b( |$)' THEN RETURN false; END IF;
  IF v_country='greece' AND v_label ~* '(^| )football league( |$)' THEN RETURN false; END IF;
  IF v_country='albania' AND v_label ~* '(^| )second division( |$)' THEN RETURN false; END IF;
  RETURN v_label ~* '(^| )(premier league|premiership|championship|super league|superliga|super lig|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|primera division|segunda division|primera divisio|segunda divisio|eredivisie|eerste divisie|keuken kampioen divisie|primeira liga|liga portugal|liga portugal 2|segunda liga|segunda divisao|ekstraklasa|i liga|1 liga|2 liga|a lyga|i lyga|1 lyga|2 lyga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|1 divisjon|premier division|league of ireland premier|league of ireland first|scottish championship|challenge league|first division|second division|first league|second league|first professional league|second professional league|first professional football league|second professional football league|national football league|nb i|nb ii|nemzeti bajnoksag i|nemzeti bajnoksag ii|kategoria superiore|kategoria e pare|prva liga|prva nl|first nl|2 snl|1 snl|cymru premier|cymru north|cymru south|persha liga|divizia nationala|liga i|liga ii|liga 1|liga 2|super league 2|super liga|super liga 2|meistaradeildin|besta deild|urvalsdeild|lengjudeild|national division|abissnet superiore|bgl ligue|efbet league|toplyga|liga 7777|meridianbet 1 cfl|prva mfl|wwin liga)( |$)';
END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_is_eligible_european_match(p_country text,p_competition text,p_gender text,p_home_team text,p_away_team text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
  SELECT public.moneyball_is_european_top_two_league(p_country,p_competition)
    AND coalesce(nullif(lower(btrim(p_gender)),''),'men')='men'
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|ladies|girls|wfc|fcw)([^a-z0-9]|$)'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|ladies|girls|wfc|fcw)([^a-z0-9]|$)'
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(reserves?|academy|youth|u[0-9]{1,2}|under[ -]*[0-9]{1,2}|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico|ii|iii|b)$'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(reserves?|academy|youth|u[0-9]{1,2}|under[ -]*[0-9]{1,2}|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico|ii|iii|b)$'
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])w$'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])w$';
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_safe_timestamptz(p_value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
BEGIN
  IF nullif(btrim(p_value),'') IS NULL THEN RETURN NULL; END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_prediction_has_sufficient_evidence(p_model_version text,p_data_source text,p_rationale text,p_data_coverage jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
  SELECT nullif(btrim(coalesce(p_data_source,'')),'') IS NOT NULL
    AND upper(coalesce(p_data_source,'')) NOT IN ('NO_VERIFIED_SOURCE','BASELINE_FALLBACK')
    AND nullif(btrim(coalesce(p_rationale,'')),'') IS NOT NULL
    AND lower(coalesce(p_data_coverage->>'baseline_only','false')) <> 'true'
    AND nullif(btrim(coalesce(p_data_coverage->>'model_source_type','')),'') IS NOT NULL
    AND upper(coalesce(p_data_coverage->>'model_source_type','')) NOT IN ('BASELINE_ONLY','BEYONDELO_ONLY')
    AND CASE WHEN coalesce(p_data_coverage->>'model_coverage','') ~ '^[0-9]+([.][0-9]+)?$' THEN (p_data_coverage->>'model_coverage')::numeric >= 55 ELSE false END
    AND (
      (CASE WHEN coalesce(p_data_coverage->>'home_history_matches','') ~ '^[0-9]+$' THEN (p_data_coverage->>'home_history_matches')::integer ELSE 0 END >= 3
       AND CASE WHEN coalesce(p_data_coverage->>'away_history_matches','') ~ '^[0-9]+$' THEN (p_data_coverage->>'away_history_matches')::integer ELSE 0 END >= 3)
      OR (
        lower(coalesce(p_data_coverage->>'market_odds','false'))='true'
        AND upper(coalesce(p_data_coverage->>'odds_status',''))='CONFIRMED'
        AND lower(coalesce(p_data_coverage->>'odds_phase',''))='prematch'
        AND lower(coalesce(p_data_coverage->>'odds_suspended','false')) <> 'true'
        AND nullif(btrim(coalesce(p_data_coverage->>'odds_bookmaker','')),'') IS NOT NULL
        AND coalesce(p_data_coverage->>'odds_source','') !~* '(tipsaudit|fair.?market|fair.?odds)'
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_prediction_has_fresh_confirmed_odds(p_odds numeric,p_data_coverage jsonb,p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
DECLARE
  v_source text := btrim(coalesce(p_data_coverage->>'odds_source',''));
  v_bookmaker text := btrim(coalesce(p_data_coverage->>'odds_bookmaker',''));
  v_captured timestamptz := public.moneyball_safe_timestamptz(p_data_coverage->>'odds_captured_at');
BEGIN
  IF p_odds IS NULL OR p_odds <= 1 OR v_source='' OR v_bookmaker='' THEN RETURN false; END IF;
  IF v_source ~* '(tipsaudit|fair.?market|fair.?odds)' THEN RETURN false; END IF;
  IF upper(coalesce(p_data_coverage->>'odds_status','')) <> 'CONFIRMED' THEN RETURN false; END IF;
  IF lower(coalesce(p_data_coverage->>'odds_phase','')) <> 'prematch' THEN RETURN false; END IF;
  IF lower(coalesce(p_data_coverage->>'odds_suspended','false'))='true' THEN RETURN false; END IF;
  IF v_captured IS NULL OR v_captured>p_now OR v_captured<p_now-interval '6 hours' THEN RETURN false; END IF;
  IF lower(v_source)='manual' AND coalesce(p_data_coverage->>'odds_source_url','') !~* '^https?://[^[:space:]]+$' THEN RETURN false; END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_guard_european_top_two_insert_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $function$
DECLARE fixture record; v_country text; v_competition text; v_gender text; v_home text; v_away text;
BEGIN
  IF tg_table_name='matches' THEN
    v_country:=coalesce(new.country,''); v_competition:=coalesce(new.competition,new.league,'');
    v_gender:=coalesce(nullif(lower(new.gender),''),'men'); v_home:=coalesce(new.home_team,''); v_away:=coalesce(new.away_team,'');
  ELSIF tg_table_name='predictions' THEN
    SELECT m.country,coalesce(m.competition,m.league,'') competition,coalesce(nullif(lower(m.gender),''),'men') gender,m.home_team,m.away_team
      INTO fixture FROM public.matches m WHERE m.id=new.match_id AND m.owner_id=coalesce(new.owner_id,new.user_id);
    IF NOT found THEN RETURN null; END IF;
    v_country:=coalesce(fixture.country,''); v_competition:=coalesce(fixture.competition,''); v_gender:=fixture.gender;
    v_home:=coalesce(fixture.home_team,''); v_away:=coalesce(fixture.away_team,'');
  ELSE RETURN new;
  END IF;
  IF NOT public.moneyball_is_eligible_european_match(v_country,v_competition,v_gender,v_home,v_away) THEN RETURN null; END IF;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS trg_moneyball_scope_guard_matches ON public.matches;
CREATE TRIGGER trg_moneyball_scope_guard_matches BEFORE INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.moneyball_guard_european_top_two_insert_scope();
DROP TRIGGER IF EXISTS trg_moneyball_scope_guard_predictions ON public.predictions;
CREATE TRIGGER trg_moneyball_scope_guard_predictions BEFORE INSERT ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.moneyball_guard_european_top_two_insert_scope();

CREATE OR REPLACE FUNCTION public.moneyball_block_new_test_coupon()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF upper(btrim(coalesce(NEW.coupon_type,'')))='TEST' THEN RAISE EXCEPTION 'New TEST coupons are disabled in production MONEYBALL MAIN.'; END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_moneyball_block_test_coupon ON public.coupons;
CREATE TRIGGER trg_moneyball_block_test_coupon BEFORE INSERT ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.moneyball_block_new_test_coupon();

CREATE OR REPLACE FUNCTION public.moneyball_guard_coupon_leg_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_coupon record; v_match record; v_prediction record;
BEGIN
  SELECT c.owner_id,c.coupon_type,c.source_class,c.target_legs,c.stake INTO v_coupon FROM public.coupons c WHERE c.id=NEW.coupon_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found for leg insertion.'; END IF;
  IF NEW.owner_id IS DISTINCT FROM v_coupon.owner_id THEN RAISE EXCEPTION 'Coupon leg owner does not match coupon owner.'; END IF;
  IF upper(coalesce(v_coupon.coupon_type,'')) NOT IN ('MAIN','MEGA','EXTRA') OR coalesce(v_coupon.source_class,'MODEL')='PAPER' OR v_coupon.stake IS DISTINCT FROM 4.00 THEN
    RAISE EXCEPTION 'Only official EUR 4 MAIN/AKO coupons can receive new legs.';
  END IF;
  IF (v_coupon.target_legs=1 AND v_coupon.coupon_type<>'MAIN') OR (v_coupon.target_legs=3 AND v_coupon.coupon_type NOT IN ('MEGA','EXTRA')) OR v_coupon.target_legs NOT IN (1,3) THEN
    RAISE EXCEPTION 'Coupon type and target leg count are inconsistent.';
  END IF;
  SELECT m.id,m.owner_id,m.country,m.competition,m.league,m.gender,m.home_team,m.away_team,m.kickoff_at,m.status
    INTO v_match FROM public.matches m WHERE m.id=NEW.match_id AND m.owner_id=v_coupon.owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon leg match is missing or owned by another user.'; END IF;
  IF NOT public.moneyball_is_eligible_european_match(v_match.country,coalesce(v_match.competition,v_match.league),v_match.gender,v_match.home_team,v_match.away_team) THEN
    RAISE EXCEPTION 'Coupon leg is outside the European men's domestic tier 1-2 scope.';
  END IF;
  IF v_match.kickoff_at IS NULL OR v_match.kickoff_at<=now() OR (v_match.kickoff_at AT TIME ZONE 'Europe/Brussels')::date<>(now() AT TIME ZONE 'Europe/Brussels')::date
     OR lower(v_match.status) IN ('live','finished','ft','aet','pen','postponed','cancelled','abandoned') THEN
    RAISE EXCEPTION 'Coupon legs must be today's future prematch fixtures.';
  END IF;
  SELECT p.id,p.owner_id,p.match_id,p.model_version,p.data_source,p.rationale,p.data_coverage,p.verdict,p.settlement_status,p.probability,p.selection,p.odds
    INTO v_prediction FROM public.predictions p WHERE p.id=NEW.prediction_id AND p.match_id=NEW.match_id AND p.owner_id=v_coupon.owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon leg prediction does not match the selected fixture.'; END IF;
  IF v_prediction.verdict<>'WYBRANY' OR v_prediction.settlement_status<>'pending' OR v_prediction.probability IS NULL OR v_prediction.probability<=75 OR coalesce(v_prediction.selection,'') IN ('','—') THEN
    RAISE EXCEPTION 'Coupon leg requires a pending selected prediction above 75 percent.';
  END IF;
  IF NOT public.moneyball_prediction_has_sufficient_evidence(v_prediction.model_version,v_prediction.data_source,v_prediction.rationale,v_prediction.data_coverage) THEN
    RAISE EXCEPTION 'Coupon leg prediction does not meet the verified evidence threshold.';
  END IF;
  IF NOT public.moneyball_prediction_has_fresh_confirmed_odds(v_prediction.odds,v_prediction.data_coverage,now()) THEN
    RAISE EXCEPTION 'Coupon leg requires fresh confirmed prematch bookmaker odds.';
  END IF;
  IF NEW.odds IS NULL OR NEW.odds<=1 OR NEW.odds IS DISTINCT FROM v_prediction.odds THEN
    RAISE EXCEPTION 'Coupon leg payout odds must equal the confirmed prediction odds at placement.';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_moneyball_guard_coupon_leg_scope ON public.coupon_legs;
CREATE TRIGGER trg_moneyball_guard_coupon_leg_scope BEFORE INSERT OR UPDATE OF coupon_id,prediction_id,match_id ON public.coupon_legs FOR EACH ROW EXECUTE FUNCTION public.moneyball_guard_coupon_leg_scope();

CREATE OR REPLACE FUNCTION public.moneyball_lock_coupon_leg_odds()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF NEW.odds IS DISTINCT FROM OLD.odds THEN RAISE EXCEPTION 'Coupon leg odds are locked at placement; prediction price changes cannot rewrite a placed coupon.'; END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_moneyball_lock_coupon_leg_odds ON public.coupon_legs;
CREATE TRIGGER trg_moneyball_lock_coupon_leg_odds BEFORE UPDATE OF odds ON public.coupon_legs FOR EACH ROW EXECUTE FUNCTION public.moneyball_lock_coupon_leg_odds();

-- Freeze payout prices at placement: prediction quote refreshes must not rewrite coupon odds/potential_return.
DROP TRIGGER IF EXISTS trg_sync_coupon_leg_odds_from_prediction ON public.predictions;

CREATE OR REPLACE FUNCTION public.moneyball_dashboard_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with owner_scope as (select auth.uid() as owner_id),
active_predictions as (
  select p.market, p.settlement_status, p.verified
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  join owner_scope o on p.owner_id = o.owner_id
  where (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
    and public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
),
market_stats as (
  select market,
    count(*) filter (where verified and settlement_status = 'won')::integer as won,
    count(*) filter (where verified and settlement_status in ('won','lost'))::integer as settled
  from active_predictions group by market
),
candidate_count as (
  select count(distinct p.match_id)::integer as total
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  join owner_scope o on p.owner_id = o.owner_id
  where (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and p.verdict = 'WYBRANY' and p.settlement_status = 'pending'
    and p.probability > 75 and p.selection <> '—'
    and public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
    and public.moneyball_prediction_has_fresh_confirmed_odds(p.odds,p.data_coverage,now())
    and m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
    and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
    and m.status not in ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
    and m.kickoff_at > now()
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
),
bankroll as (
  select case when count(*) = 0 then null
    else coalesce(
      (array_agg(balance_after order by occurred_at desc) filter (where balance_after is not null))[1],
      sum(case
        when transaction_type in ('deposit','return') then abs(amount)
        when transaction_type in ('withdrawal','stake') then -abs(amount)
        else amount end)
    ) end as balance
  from public.bankroll_transactions b
  join owner_scope o on b.owner_id = o.owner_id
)
select jsonb_build_object(
  'matches_today', (
    select count(*)::integer from public.matches m
    join owner_scope o on m.owner_id = o.owner_id
    where m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
      and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
      and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
  ),
  'bankroll', (select balance from bankroll),
  'coupons_in_play', (
    select count(*)::integer from public.coupons c
    join owner_scope o on c.owner_id = o.owner_id
    where coalesce(c.status, 'pending') = 'pending'
      and c.coupon_type in ('MAIN','MEGA','EXTRA')
      and coalesce(c.source_class,'MODEL') <> 'PAPER'
      and c.target_legs in (1,3)
      and (select count(*) from public.coupon_legs l where l.owner_id=c.owner_id and l.coupon_id=c.id)=c.target_legs
      and not exists (
        select 1 from public.coupon_legs l
        join public.matches m on m.id=l.match_id and m.owner_id=l.owner_id
        where l.owner_id=c.owner_id and l.coupon_id=c.id
          and (
            not public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
            or m.kickoff_at is null or m.kickoff_at <= now()
            or (m.kickoff_at at time zone 'Europe/Brussels')::date <> (now() at time zone 'Europe/Brussels')::date
            or lower(m.status) in ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
          )
      )
  ),
  'candidates', coalesce((select total from candidate_count), 0),
  'to_settle', (
    select count(*)::integer from public.matches m
    join owner_scope o on m.owner_id = o.owner_id
    where m.kickoff_at < now() and m.status not in ('finished','postponed','cancelled')
      and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
      and not exists (
        select 1 from public.match_results r
        where r.match_id = m.id and r.owner_id = m.owner_id and r.verified
      )
  ),
  'hit_rates', coalesce((
    select jsonb_object_agg(market, jsonb_build_object(
      'won', won, 'settled', settled,
      'rate', case when settled > 0 then round((won::numeric / settled::numeric) * 1000) / 10 else null end
    )) from market_stats
  ), '{}'::jsonb)
);
$function$

CREATE OR REPLACE FUNCTION public.moneyball_dashboard_selected_picks()
 RETURNS TABLE(prediction_id uuid, market text, selection text, probability numeric, odds numeric, settlement_status text, match_id uuid, home_team text, away_team text, competition text, league text, kickoff_at timestamp with time zone, kickoff_date date, match_status text, home_score integer, away_score integer, rationale text, confidence text, data_coverage jsonb)
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
    and p.settlement_status = 'pending'
    and p.probability > 75 and p.selection <> '—'
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
    and public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
    and public.moneyball_prediction_has_fresh_confirmed_odds(p.odds,p.data_coverage,now())
    and m.kickoff_at > now()
    and lower(m.status) not in ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
    and m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
    and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
  order by m.kickoff_at asc nulls last, p.created_at desc
  limit 100;
$function$

CREATE OR REPLACE FUNCTION public.moneyball_statistics_page_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return (
    with eligible_matches as materialized (
      select
        m.id, m.competition, m.country, m.gender, m.home_team, m.away_team,
        m.kickoff_at, m.league, m.kickoff_date,
        result.home_score, result.away_score
      from public.matches m
      left join lateral (
        select r.home_score, r.away_score
        from public.match_results r
        where r.owner_id = m.owner_id and r.match_id = m.id and r.verified is true
        order by r.verified_at desc nulls last, r.created_at desc
        limit 1
      ) result on true
      where m.owner_id = v_owner
        and public.moneyball_is_eligible_european_match(
          m.country, coalesce(m.competition, m.league), m.gender, m.home_team, m.away_team
        )
    ),
    active_predictions as (
      select
        p.id, p.match_id, p.model_version, p.market, p.selection, p.probability,
        p.verdict, p.rationale, p.odds, p.settlement_status, p.verified,
        p.stake, p.potential_return, p.profit_loss
      from public.predictions p
      where p.owner_id = v_owner
        and (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
        and public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
        and exists (select 1 from eligible_matches m where m.id = p.match_id)
    ),
    scoped_coupon_ids as (
      select c.id
      from public.coupons c
      where c.owner_id = v_owner
        and c.coupon_type in ('MAIN','MEGA','EXTRA')
        and coalesce(c.source_class,'MODEL') <> 'PAPER'
        and c.target_legs in (1,3)
        and (select count(*) from public.coupon_legs l where l.owner_id=v_owner and l.coupon_id=c.id)=c.target_legs
        and exists (select 1 from public.coupon_legs l where l.owner_id = v_owner and l.coupon_id = c.id)
        and not exists (
          select 1 from public.coupon_legs l
          where l.owner_id = v_owner and l.coupon_id = c.id
            and not exists (select 1 from eligible_matches m where m.id = l.match_id)
        )
    ),
    scoped_coupons as (
      select c.id, c.status, c.stake
      from public.coupons c
      join scoped_coupon_ids ids on ids.id = c.id
      where c.owner_id = v_owner
    ),
    scoped_legs as (
      select l.id, l.coupon_id, l.match_id, l.odds, l.status
      from public.coupon_legs l
      join scoped_coupon_ids ids on ids.id = l.coupon_id
      where l.owner_id = v_owner
    )
    select jsonb_build_object(
      'matches', coalesce((select jsonb_agg(to_jsonb(m) order by m.kickoff_at asc nulls last, m.id) from eligible_matches m), '[]'::jsonb),
      'predictions', coalesce((select jsonb_agg(to_jsonb(p) order by p.model_version, p.market, p.match_id, p.selection) from active_predictions p), '[]'::jsonb),
      'coupons', coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from scoped_coupons c), '[]'::jsonb),
      'legs', coalesce((select jsonb_agg(to_jsonb(l) order by l.coupon_id, l.id) from scoped_legs l), '[]'::jsonb)
    )
  );
end;
$function$


DO $scope_assertions$
BEGIN
  IF NOT public.moneyball_is_eligible_european_match('England','Premier League','men','Arsenal','Chelsea') THEN RAISE EXCEPTION 'Premier League men's fixture unexpectedly rejected.'; END IF;
  IF NOT public.moneyball_is_eligible_european_match('Germany','2. Bundesliga','men','Dresden','Hannover') THEN RAISE EXCEPTION '2. Bundesliga men's fixture unexpectedly rejected.'; END IF;
  IF public.moneyball_is_eligible_european_match('England','National League North','men','Oxford City','Macclesfield') THEN RAISE EXCEPTION 'English tier 6 incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('France','National 2 - Group C','men','Andrezieux','Chateauroux') THEN RAISE EXCEPTION 'French tier 4 incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('England','Premier League','women','Arsenal','Chelsea') THEN RAISE EXCEPTION 'Women's fixture incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('England','Premier League','men','Arsenal Women','Chelsea') THEN RAISE EXCEPTION 'Women's team incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('England','Premier League','men','Arsenal U21','Chelsea') THEN RAISE EXCEPTION 'Youth team incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('England','Premier League','men','Arsenal B','Chelsea') THEN RAISE EXCEPTION 'Reserve team incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('World','UEFA Nations League','men','Belgium','France') THEN RAISE EXCEPTION 'UEFA Nations League incorrectly accepted.'; END IF;
  IF public.moneyball_is_eligible_european_match('Turkey','Super Lig','men','Galatasaray','Fenerbahce') THEN RAISE EXCEPTION 'Non-M49 Turkey scope incorrectly accepted.'; END IF;
  IF public.moneyball_is_geographic_europe_country('Türkiye') THEN RAISE EXCEPTION 'UEFA membership incorrectly widened geographic Europe.'; END IF;
END;
$scope_assertions$;

DO $test_coupon_guard$
DECLARE v_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.coupons(owner_id,name,coupon_type,target_legs,stake,source_class)
    VALUES (gen_random_uuid(),'MAIN audit guard test','TEST',3,0,'PAPER');
  EXCEPTION WHEN others THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'New TEST coupon was not blocked.'; END IF;
END;
$test_coupon_guard$;
