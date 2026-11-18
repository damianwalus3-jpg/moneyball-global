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
  IF (v_country='croatia' AND v_label='hnl') OR (v_country='sanmarino' AND v_label='campionato') THEN RETURN true; END IF;
  IF v_country IN ('scotland','sco') AND v_label ~* '\m(lowland league|highland league)\M' THEN RETURN false; END IF;
  IF v_country IN ('denmark','dnk','norway','nor','belarus','blr') AND v_label ~* '\m2 division\M' THEN RETURN false; END IF;
  IF v_country IN ('denmark','dnk') AND v_label ~* '\m2nd division\M' THEN RETURN false; END IF;
  IF v_country IN ('russia','rus') AND v_label ~* '\msecond league\M' THEN RETURN false; END IF;
  IF v_country IN ('spain','esp') AND v_label ~* '\m(primera division rfef|segunda division rfef)\M' THEN RETURN false; END IF;
  IF v_country IN ('switzerland','sui','che') AND v_label ~* '\m1 liga (promotion|classic)\M' THEN RETURN false; END IF;
  IF v_country IN ('sweden','swe') AND v_label ~* '\mdivision [12]\M' THEN RETURN false; END IF;
  IF v_country IN ('albania','alb') AND v_label ~* '\m2nd division\M' THEN RETURN false; END IF;
  IF v_country IN ('croatia','cro') AND v_label ~* '\msecond nl\M' THEN RETURN false; END IF;
  IF v_country IN ('estonia','est') AND v_label ~* '\mesiliiga b\M' THEN RETURN false; END IF;
  IF v_country IN ('greece','gre','grc') AND v_label ~* '\mfootball league\M' THEN RETURN false; END IF;
  IF v_country IN ('poland','pol') AND v_label ~* '\m(ii|2) liga\M' THEN RETURN false; END IF;
  IF v_label ~* '\m(serie c|serie d|lega pro|serie c1|serie c2|league one|league two|league three)\M' THEN RETURN false; END IF;
  IF v_label ~* '\m(uefa|nations league|champions league|europa league|conference league|world cup|international|national [2-5]|cup|copa|trophy|play ?offs?)\M' THEN RETURN false; END IF;
  IF v_label ~* '\m(premier league 2|pl2|professional development league|u(17|18|19|20|21|23)|under ?(17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|women|woman|female|frauen|damen|feminine|femminile|femenina|ladies|girls|damallsvenskan|wsl|liga f|summer series)\M' THEN RETURN false; END IF;
  IF v_label ~* '\m(druha liga|(3|4|5|6|7|8|9|iii|iv|v|vi)\s*\.?\s*(liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)|third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\M' THEN RETURN false; END IF;
  RETURN v_label ~* '\m(premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|austrian 2 liga|2 liga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|primera division|segunda division|segunda liga|segunda divisao|liga portugal 2|liga portugal|eredivisie|eerste divisie|keuken kampioen divisie|primeira liga|ekstraklasa|i liga|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|liga e pare|prva liga|first league|second league|fnl|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|1 lyga|i lyga|1 snl|virsliga|meistriliiga|esiliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|1 divisjon|premier division|league of ireland premier|league of ireland first|scottish championship|challenge league|tff first league|national football league|football league|nb i|nb ii|nemzeti bajnoksag i|nemzeti bajnoksag ii|kategoria superiore|kategoria e pare|premyer liqa|i liqa|1 deild|cymru premier|cymru north|cymru south|erovnuli liga|e rovnuli liga|erovnuli liga 2|first nl|prva nl|2 snl|persha liga|first professional football league|second professional football league|bulgarian second league|first division a|first division b|1 division|2 division|divizia nationala|divizia a|1a divisio|2a divisio|primera divisio|segunda divisio|albanian superliga|armenian premier league|belarusian premier league|belarusian first league|premijer liga|first professional league|meistaradeildin|besta deild|urvalsdeild|national division|super liga|super liga 2|super liga Srbije|superliga kosovo|campionato sammarinese|2 mfl|vtora mfl|prva makedonska|super league greece|super liga romania|liga 1 romania|liga 2 romania|montenegro first league|azerbaijan premier league|premyer liqasi|super league albania|lliga multisegur assegurances|lliga grup pirineu|abissnet superiore|bgl ligue|promotion d honneur|albi mall superliga|vbet malta premier league|malta premier league|czech liga|vysshaya liga|pervaya liga|birinci dasta|birinci liqa|azerbaijan first division|azerbaijan first league|liga leumit|ligat haal|ligat ha al|israeli national league|kazakhstan first division|kazakhstan first league|qazaqstan first league|division d honneur|luxembourg division of honour|division of honour|moldovan super liga|moldova liga 1|liga 1 moldova|liga 7777|ligat winner|winner league|meistaradeildin|meistara deildin|lengjudeild karla|1 deild menn|montenegrin second league|second league montenegro|meridianbet 1 cfl|prva mfl|first mfl|wwin liga bih|wwin liga bosne i hercegovine|first league federation of bih|first league of the federation of bih|first league of republika srpska|prva liga federacije bih|prva liga republike srpska|prva liga republike srpske|efbet liga|efbet league|toplyga|cyprus second division|cypriot second division|cyprus league b|league b cyprus|1 deild karla|league of ireland first division|league of ireland premier division|nifl championship|nifl premiership|gibraltar football league|gibraltar second division|malta challenge league|challenge league malta|premier league malta|superliga e shqiperise|armenian first league|bosnian premier league|premijer liga bih|croatian first football league|first football league croatia|prva nogometna liga|czech first league|chance liga|dansk superliga|superligaen|danish 1st division|danish first division|finnish first division|greek super league|premier division ireland|island premier league|israeli premier league|lithuanian a lyga|lithuanian i lyga|latvian higher league|latvian first league|maltese premier league|maltese challenge league|norwegian first division|serbian super liga|slovak first football league|nike liga|prva slovenska nogometna liga|druga slovenska nogometna liga|swiss super league|swiss challenge league|turkish first league|ukrainian premier league|welsh premier league)\M';
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
        AND btrim(coalesce(p_data_coverage->>'odds_bookmaker','')) ~* '(bwin|unibet|ladbrokes|circus|bet\\s*first)'
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
  IF p_odds IS NULL OR p_odds <= 1 OR v_source='' OR v_bookmaker !~* '(bwin|unibet|ladbrokes|circus|bet\\s*first)' THEN RETURN false; END IF;
  IF v_source ~* '(tipsaudit|fair.?market|fair.?odds)' THEN RETURN false; END IF;
  IF upper(coalesce(p_data_coverage->>'odds_status','')) <> 'CONFIRMED' THEN RETURN false; END IF;
  IF lower(coalesce(p_data_coverage->>'odds_phase','')) <> 'prematch' THEN RETURN false; END IF;
  IF lower(coalesce(p_data_coverage->>'odds_suspended','false'))='true' THEN RETURN false; END IF;
  IF v_captured IS NULL OR v_captured>p_now OR v_captured<p_now-interval '6 hours' THEN RETURN false; END IF;
  IF lower(v_source)='manual' AND coalesce(p_data_coverage->>'odds_source_url','') !~* '^https?://[^[:space:]]+$' THEN RETURN false; END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_is_openmatchday_tier(p_source text,p_external_id text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
  SELECT lower(btrim(coalesce(p_source,''))) <> 'openmatchday'
    OR (
      coalesce(p_external_id,'') ~* '^om:[A-Z]{3}_[12]_[A-Za-z0-9-]+:'
      AND coalesce(p_external_id,'') !~* '(cup|women|womens|female|youth|academy|reserve|u[0-9]{1,2})'
    );
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_guard_european_top_two_insert_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $function$
DECLARE fixture record; v_country text; v_competition text; v_gender text; v_home text; v_away text; v_source text; v_external_id text;
BEGIN
  IF tg_table_name='matches' THEN
    v_country:=coalesce(new.country,''); v_competition:=coalesce(new.competition,new.league,'');
    v_gender:=coalesce(nullif(lower(new.gender),''),'men'); v_home:=coalesce(new.home_team,''); v_away:=coalesce(new.away_team,'');
    v_source:=coalesce(new.source,''); v_external_id:=coalesce(new.external_id,'');
  ELSIF tg_table_name='predictions' THEN
    SELECT m.country,coalesce(m.competition,m.league,'') competition,coalesce(nullif(lower(m.gender),''),'men') gender,
           m.home_team,m.away_team,m.source,m.external_id
      INTO fixture FROM public.matches m WHERE m.id=new.match_id AND m.owner_id=coalesce(new.owner_id,new.user_id);
    IF NOT found THEN RETURN null; END IF;
    v_country:=coalesce(fixture.country,''); v_competition:=coalesce(fixture.competition,''); v_gender:=fixture.gender;
    v_home:=coalesce(fixture.home_team,''); v_away:=coalesce(fixture.away_team,'');
    v_source:=coalesce(fixture.source,''); v_external_id:=coalesce(fixture.external_id,'');
  ELSE RETURN new;
  END IF;
  IF NOT public.moneyball_is_eligible_european_match(v_country,v_competition,v_gender,v_home,v_away)
     OR NOT public.moneyball_is_openmatchday_tier(v_source,v_external_id) THEN RETURN null; END IF;
  IF tg_table_name='matches' AND tg_op='INSERT' AND (new.kickoff_at IS NOT NULL OR new.kickoff_date IS NOT NULL) THEN
    v_day:=coalesce((new.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,new.kickoff_date);
    v_home_key:=regexp_replace(normalize(lower(btrim(v_home)),NFD),'[^a-z0-9]+','','g');
    v_away_key:=regexp_replace(normalize(lower(btrim(v_away)),NFD),'[^a-z0-9]+','','g');
    PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(new.owner_id::text,'')||'|'||v_day::text||'|'||v_home_key||'|'||v_away_key,0));
    IF EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.owner_id=new.owner_id AND coalesce((m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,m.kickoff_date)=v_day
        AND regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g')=v_home_key
        AND regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g')=v_away_key
        AND public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
        AND public.moneyball_is_openmatchday_tier(m.source,m.external_id)
    ) THEN RETURN NULL; END IF;
  END IF;
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
CREATE TRIGGER trg_moneyball_block_test_coupon BEFORE INSERT OR UPDATE OF coupon_type ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.moneyball_block_new_test_coupon();

CREATE OR REPLACE FUNCTION public.moneyball_guard_coupon_leg_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_coupon record; v_match record; v_prediction record;
BEGIN
  SELECT c.owner_id,c.coupon_type,c.source_class,c.target_legs,c.stake,c.status INTO v_coupon FROM public.coupons c WHERE c.id=NEW.coupon_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found for leg insertion.'; END IF;
  IF NEW.owner_id IS DISTINCT FROM v_coupon.owner_id THEN RAISE EXCEPTION 'Coupon leg owner does not match coupon owner.'; END IF;
  IF upper(coalesce(v_coupon.coupon_type,'')) NOT IN ('MAIN','MEGA','EXTRA') OR coalesce(v_coupon.source_class,'MODEL')='PAPER' OR v_coupon.stake IS DISTINCT FROM 4.00 OR coalesce(v_coupon.status,'') <> 'pending' THEN
    RAISE EXCEPTION 'Only official EUR 4 MAIN/AKO coupons can receive new legs.';
  END IF;
  IF (v_coupon.target_legs=1 AND v_coupon.coupon_type<>'MAIN') OR (v_coupon.target_legs=3 AND v_coupon.coupon_type NOT IN ('MEGA','EXTRA')) OR v_coupon.target_legs NOT IN (1,3) THEN
    RAISE EXCEPTION 'Coupon type and target leg count are inconsistent.';
  END IF;
  IF NEW.leg_number > v_coupon.target_legs OR (SELECT count(*) FROM public.coupon_legs l WHERE l.coupon_id=NEW.coupon_id) >= v_coupon.target_legs THEN
    RAISE EXCEPTION 'Coupon cannot contain more legs than its fixed target.';
  END IF;
  SELECT m.id,m.owner_id,m.country,m.competition,m.league,m.gender,m.home_team,m.away_team,m.source,m.external_id,m.kickoff_at,m.status
    INTO v_match FROM public.matches m WHERE m.id=NEW.match_id AND m.owner_id=v_coupon.owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon leg match is missing or owned by another user.'; END IF;
  IF NOT public.moneyball_is_eligible_european_match(v_match.country,coalesce(v_match.competition,v_match.league),v_match.gender,v_match.home_team,v_match.away_team)
     OR NOT public.moneyball_is_openmatchday_tier(v_match.source,v_match.external_id) THEN
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
  IF EXISTS (
    SELECT 1
    FROM public.coupon_legs l
    JOIN public.matches m ON m.id=l.match_id AND m.owner_id=l.owner_id
    WHERE l.owner_id=NEW.owner_id AND l.coupon_id=NEW.coupon_id AND l.id<>NEW.id
      AND m.kickoff_at IS NOT NULL AND v_match.kickoff_at IS NOT NULL
      AND (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date=(v_match.kickoff_at AT TIME ZONE 'Europe/Brussels')::date
      AND regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g')=regexp_replace(normalize(lower(btrim(coalesce(v_match.home_team,''))),NFD),'[^a-z0-9]+','','g')
      AND regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g')=regexp_replace(normalize(lower(btrim(coalesce(v_match.away_team,''))),NFD),'[^a-z0-9]+','','g')
  ) THEN
    RAISE EXCEPTION 'A coupon cannot contain the same Brussels-date team pair more than once.';
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
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
WITH owner_scope AS (SELECT auth.uid() AS owner_id),
eligible_matches AS (
  SELECT DISTINCT ON (
    m.owner_id,coalesce((m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,m.kickoff_date),
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g')
  )
    m.id,m.owner_id,m.country,m.competition,m.league,m.gender,m.home_team,m.away_team,
    m.kickoff_at,m.kickoff_date,m.status,m.source,m.external_id,
    coalesce((m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,m.kickoff_date) AS brussels_day,
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g') AS home_key,
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g') AS away_key
  FROM public.matches m JOIN owner_scope o ON m.owner_id=o.owner_id
  WHERE (m.kickoff_at IS NOT NULL OR m.kickoff_date IS NOT NULL)
    AND public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
    AND public.moneyball_is_openmatchday_tier(m.source,m.external_id)
  ORDER BY m.owner_id,coalesce((m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,m.kickoff_date),
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g'),
    (lower(coalesce(m.source,''))='footynomad') DESC,coalesce(m.updated_at,m.created_at) DESC,m.id
),
eligible_matches_today AS (
  SELECT * FROM eligible_matches WHERE brussels_day=(now() AT TIME ZONE 'Europe/Brussels')::date
),
active_predictions AS (
  SELECT DISTINCT ON (m.brussels_day,m.home_key,m.away_key,p.market,p.selection)
    p.market,p.selection,p.settlement_status,p.verified,p.created_at,p.id
  FROM public.predictions p
  JOIN eligible_matches m ON m.id=p.match_id AND m.owner_id=p.owner_id
  WHERE (p.model_version='MONEYBALL GLOBAL 3.8' OR p.model_version LIKE 'MANUAL%')
  ORDER BY m.brussels_day,m.home_key,m.away_key,p.market,p.selection,p.created_at DESC,p.id DESC
),
market_stats AS (
  SELECT market,
    count(*) FILTER (WHERE verified AND settlement_status='won')::integer AS won,
    count(*) FILTER (WHERE verified AND settlement_status IN ('won','lost'))::integer AS settled
  FROM active_predictions GROUP BY market
),
candidate_count AS (
  SELECT count(DISTINCT (m.brussels_day::text||'|'||m.home_key||'|'||m.away_key))::integer AS total
  FROM public.predictions p
  JOIN eligible_matches_today m ON m.id=p.match_id AND m.owner_id=p.owner_id
  WHERE (p.model_version='MONEYBALL GLOBAL 3.8' OR p.model_version LIKE 'MANUAL%')
    AND p.verdict='WYBRANY' AND p.settlement_status='pending'
    AND p.probability>75 AND p.selection<>'—'
    AND public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
    AND public.moneyball_prediction_has_fresh_confirmed_odds(p.odds,p.data_coverage,now())
    AND m.kickoff_at>now() AND lower(m.status) NOT IN ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
),
pending_coupons AS (
  SELECT c.id
  FROM public.coupons c JOIN owner_scope o ON c.owner_id=o.owner_id
  WHERE coalesce(c.status,'pending')='pending'
    AND c.coupon_type IN ('MAIN','MEGA','EXTRA')
    AND coalesce(c.source_class,'MODEL')<>'PAPER'
    AND c.target_legs IN (1,3)
    AND (SELECT count(*) FROM public.coupon_legs l WHERE l.owner_id=c.owner_id AND l.coupon_id=c.id)=c.target_legs
    AND NOT EXISTS (
      SELECT 1 FROM public.coupon_legs l
      WHERE l.owner_id=c.owner_id AND l.coupon_id=c.id
        AND NOT EXISTS (
          SELECT 1 FROM eligible_matches_today m
          WHERE m.id=l.match_id AND m.kickoff_at>now()
            AND lower(m.status) NOT IN ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
        )
    )
),
bankroll AS (
  SELECT CASE WHEN count(*)=0 THEN NULL ELSE coalesce(
    (array_agg(balance_after ORDER BY occurred_at DESC) FILTER (WHERE balance_after IS NOT NULL))[1],
    sum(CASE WHEN transaction_type IN ('deposit','return') THEN abs(amount)
      WHEN transaction_type IN ('withdrawal','stake') THEN -abs(amount) ELSE amount END)
  ) END AS balance
  FROM public.bankroll_transactions b JOIN owner_scope o ON b.owner_id=o.owner_id
)
SELECT jsonb_build_object(
  'matches_today',(SELECT count(*)::integer FROM eligible_matches_today),
  'bankroll',(SELECT balance FROM bankroll),
  'coupons_in_play',(SELECT count(*)::integer FROM pending_coupons),
  'candidates',coalesce((SELECT total FROM candidate_count),0),
  'to_settle',(
    SELECT count(*)::integer FROM eligible_matches m
    WHERE m.kickoff_at IS NOT NULL AND m.kickoff_at<now() AND lower(m.status) NOT IN ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
      AND NOT EXISTS (SELECT 1 FROM public.match_results r WHERE r.match_id=m.id AND r.owner_id=m.owner_id AND r.verified)
  ),
  'hit_rates',coalesce((SELECT jsonb_object_agg(market,jsonb_build_object(
    'won',won,'settled',settled,
    'rate',CASE WHEN settled>0 THEN round((won::numeric/settled::numeric)*1000)/10 ELSE NULL END
  )) FROM market_stats),'{}'::jsonb)
);
$function$;

DROP FUNCTION IF EXISTS public.moneyball_dashboard_selected_picks();
CREATE FUNCTION public.moneyball_dashboard_selected_picks()
RETURNS TABLE(
  prediction_id uuid,market text,selection text,probability numeric,odds numeric,settlement_status text,
  match_id uuid,home_team text,away_team text,competition text,league text,kickoff_at timestamptz,
  kickoff_date date,match_status text,home_score integer,away_score integer,data_source text,rationale text,confidence text,data_coverage jsonb
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
WITH eligible_matches AS (
  SELECT DISTINCT ON (
    (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g')
  )
    m.id,m.owner_id,m.home_team,m.away_team,m.competition,m.league,m.kickoff_at,m.kickoff_date,m.status,
    (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date AS brussels_day,
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g') AS home_key,
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g') AS away_key
  FROM public.matches m
  WHERE m.owner_id=(SELECT auth.uid())
    AND m.kickoff_at>=(((now() AT TIME ZONE 'Europe/Brussels')::date)::timestamp AT TIME ZONE 'Europe/Brussels')
    AND m.kickoff_at<((((now() AT TIME ZONE 'Europe/Brussels')::date+1)::timestamp) AT TIME ZONE 'Europe/Brussels')
    AND public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
    AND public.moneyball_is_openmatchday_tier(m.source,m.external_id)
  ORDER BY (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
    regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
    regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g'),
    (lower(coalesce(m.source,''))='footynomad') DESC,coalesce(m.updated_at,m.created_at) DESC,m.id
),
ranked_picks AS (
  SELECT DISTINCT ON (m.brussels_day,m.home_key,m.away_key,p.market,p.selection)
    p.id AS prediction_id,p.market,p.selection,p.probability,p.odds,p.settlement_status,
    m.id AS match_id,m.home_team,m.away_team,m.competition,m.league,m.kickoff_at,m.kickoff_date,m.status AS match_status,
    r.home_score,r.away_score,p.data_source,p.rationale,p.confidence,p.data_coverage,p.created_at,
    m.brussels_day,m.home_key,m.away_key
  FROM public.predictions p
  JOIN eligible_matches m ON m.id=p.match_id AND m.owner_id=p.owner_id
  LEFT JOIN LATERAL (
    SELECT mr.home_score,mr.away_score FROM public.match_results mr
    WHERE mr.match_id=m.id AND mr.owner_id=m.owner_id AND mr.verified
    ORDER BY mr.verified_at DESC NULLS LAST,mr.created_at DESC LIMIT 1
  ) r ON true
  WHERE p.owner_id=(SELECT auth.uid())
    AND (p.model_version='MONEYBALL GLOBAL 3.8' OR p.model_version LIKE 'MANUAL%')
    AND p.verdict='WYBRANY' AND p.settlement_status='pending'
    AND p.probability>75 AND p.selection<>'—'
    AND public.moneyball_prediction_has_sufficient_evidence(p.model_version,p.data_source,p.rationale,p.data_coverage)
    AND public.moneyball_prediction_has_fresh_confirmed_odds(p.odds,p.data_coverage,now())
    AND m.kickoff_at>now()
    AND lower(m.status) NOT IN ('finished','ft','aet','pen','postponed','cancelled','abandoned','live')
  ORDER BY m.brussels_day,m.home_key,m.away_key,p.market,p.selection,p.created_at DESC,p.id DESC
)
SELECT prediction_id,market,selection,probability,odds,settlement_status,match_id,home_team,away_team,competition,league,kickoff_at,kickoff_date,match_status,home_score,away_score,data_source,rationale,confidence,data_coverage
FROM ranked_picks
ORDER BY kickoff_at ASC NULLS LAST,market,selection
LIMIT 100;
$function$;
GRANT EXECUTE ON FUNCTION public.moneyball_dashboard_selected_picks() TO authenticated;

CREATE OR REPLACE FUNCTION public.moneyball_statistics_page_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth' AS $function$
DECLARE v_owner uuid:=auth.uid();
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'authentication required' USING errcode='42501'; END IF;
  RETURN (
    WITH eligible_matches AS MATERIALIZED (
      SELECT DISTINCT ON (
        (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
        regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
        regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g')
      )
        m.id,m.competition,m.country,m.gender,m.home_team,m.away_team,m.kickoff_at,m.league,m.kickoff_date,
        (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date AS brussels_day,
        regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g') AS home_key,
        regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g') AS away_key,
        result.home_score,result.away_score
      FROM public.matches m
      LEFT JOIN LATERAL (
        SELECT r.home_score,r.away_score FROM public.match_results r
        WHERE r.owner_id=m.owner_id AND r.match_id=m.id AND r.verified IS TRUE
        ORDER BY r.verified_at DESC NULLS LAST,r.created_at DESC LIMIT 1
      ) result ON true
      WHERE m.owner_id=v_owner AND m.kickoff_at IS NOT NULL
        AND public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
        AND public.moneyball_is_openmatchday_tier(m.source,m.external_id)
      ORDER BY (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
        regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
        regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g'),
        (lower(coalesce(m.source,''))='footynomad') DESC,coalesce(m.updated_at,m.created_at) DESC,m.id
    ),
    active_predictions_ranked AS (
      SELECT DISTINCT ON (m.brussels_day,m.home_key,m.away_key,p.market,p.selection)
        p.id,p.match_id,p.model_version,p.market,p.selection,p.probability,p.verdict,p.rationale,p.odds,
        p.settlement_status,p.verified,p.stake,p.potential_return,p.profit_loss,p.data_source,p.data_coverage,p.xg_used,p.created_at
      FROM public.predictions p
      JOIN eligible_matches m ON m.id=p.match_id
      WHERE p.owner_id=v_owner
        AND (p.model_version='MONEYBALL GLOBAL 3.8' OR p.model_version LIKE 'MANUAL%')
      ORDER BY m.brussels_day,m.home_key,m.away_key,p.market,p.selection,p.created_at DESC,p.id DESC
    ),
    active_predictions AS (
      SELECT id,match_id,model_version,market,selection,probability,verdict,rationale,odds,
        settlement_status,verified,stake,potential_return,profit_loss,data_source,data_coverage,xg_used
      FROM active_predictions_ranked
    ),
    scoped_coupon_ids AS (
      SELECT c.id
      FROM public.coupons c
      WHERE c.owner_id=v_owner AND c.coupon_type IN ('MAIN','MEGA','EXTRA')
        AND coalesce(c.source_class,'MODEL')<>'PAPER' AND c.target_legs IN (1,3)
        AND (SELECT count(*) FROM public.coupon_legs l WHERE l.owner_id=v_owner AND l.coupon_id=c.id)=c.target_legs
        AND EXISTS (SELECT 1 FROM public.coupon_legs l WHERE l.owner_id=v_owner AND l.coupon_id=c.id)
        AND NOT EXISTS (
          SELECT 1 FROM public.coupon_legs l
          WHERE l.owner_id=v_owner AND l.coupon_id=c.id
            AND NOT EXISTS (SELECT 1 FROM eligible_matches m WHERE m.id=l.match_id)
        )
    ),
    scoped_coupons AS (
      SELECT c.id,c.status,c.stake FROM public.coupons c
      JOIN scoped_coupon_ids ids ON ids.id=c.id WHERE c.owner_id=v_owner
    ),
    scoped_legs AS (
      SELECT l.id,l.coupon_id,l.match_id,l.odds,l.status FROM public.coupon_legs l
      JOIN scoped_coupon_ids ids ON ids.id=l.coupon_id WHERE l.owner_id=v_owner
    )
    SELECT jsonb_build_object(
      'matches',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.kickoff_at ASC NULLS LAST,m.id) FROM eligible_matches m),'[]'::jsonb),
      'predictions',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.model_version,p.market,p.match_id,p.selection) FROM active_predictions p),'[]'::jsonb),
      'coupons',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM scoped_coupons c),'[]'::jsonb),
      'legs',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.coupon_id,l.id) FROM scoped_legs l),'[]'::jsonb)
    )
  );
END;
$function$;

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
  IF public.moneyball_is_openmatchday_tier('OpenMatchday','om:ENG_3_League-One:2026-11-18:fixture') THEN RAISE EXCEPTION 'OpenMatchday tier 3 incorrectly accepted.'; END IF;
  IF NOT public.moneyball_is_openmatchday_tier('OpenMatchday','om:ENG_2_Championship:2026-11-18:fixture') THEN RAISE EXCEPTION 'OpenMatchday tier 2 unexpectedly rejected.'; END IF;
  IF public.moneyball_is_geographic_europe_country('Türkiye') THEN RAISE EXCEPTION 'UEFA membership incorrectly widened geographic Europe.'; END IF;
END;
$scope_assertions$;

DO $test_coupon_guard$
DECLARE v_error text := '';
BEGIN
  BEGIN
    INSERT INTO public.coupons(owner_id,name,coupon_type,target_legs,stake,source_class)
    VALUES (gen_random_uuid(),'MAIN audit guard test','TEST',3,0,'PAPER');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  END;
  IF v_error NOT LIKE '%New TEST coupons are disabled%' THEN
    RAISE EXCEPTION 'New TEST coupon guard failed: %',v_error;
  END IF;
END;
$test_coupon_guard$;
