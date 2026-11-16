-- Prevent generic second-division aliases from admitting country-specific third tiers.
DO $$
DECLARE
  definition text;
  needle text := 'AND (n.comp ~*';
  replacement text := $scope$
AND NOT (
  (lower(coalesce(p_country,'')) = ANY (ARRAY['scotland','sco']) AND n.comp ~* '(lowland league|highland league)')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['turkey','tur','türkiye']) AND n.comp ~* '\m2 lig\\M')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk','norway','nor','belarus','blr']) AND n.comp ~* '\m2 division\\M')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['sweden','swe']) AND n.comp ~* '\mdivision [12]\\M')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['albania','alb']) AND n.comp ~* '2nd division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp ~* 'second nl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['estonia','est']) AND n.comp ~* 'esiliiga b')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['greece','gre','grc']) AND n.comp ~* '\mfootball league\\M')
)
AND (n.comp ~*
$scope$;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;
  IF position(needle IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected top-two allowlist insertion point not found';
  END IF;
  definition := replace(definition, needle, replacement);
  EXECUTE definition;
END $$;

DO $$
BEGIN
  IF public.moneyball_is_european_top_two_league('Scotland','Football League - Lowland League') THEN RAISE EXCEPTION 'Scottish Lowland League is tier 5'; END IF;
  IF public.moneyball_is_european_top_two_league('Scotland','Football League - Highland League') THEN RAISE EXCEPTION 'Scottish Highland League is tier 5'; END IF;
  IF public.moneyball_is_european_top_two_league('Turkey','2. Lig') THEN RAISE EXCEPTION 'Turkish 2. Lig is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Denmark','2. Division') THEN RAISE EXCEPTION 'Danish 2. Division is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Norway','2. Division - Group 1') THEN RAISE EXCEPTION 'Norwegian 2. Division is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Sweden','Division 1') THEN RAISE EXCEPTION 'Swedish Division 1 is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Sweden','Division 2 - Norra Götaland') THEN RAISE EXCEPTION 'Swedish Division 2 is tier 4'; END IF;
  IF public.moneyball_is_european_top_two_league('Belarus','2. Division') THEN RAISE EXCEPTION 'Belarus 2. Division is below tier 2'; END IF;
  IF public.moneyball_is_european_top_two_league('Albania','2nd Division - Group A') THEN RAISE EXCEPTION 'Albanian 2nd Division is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Croatia','Second NL') THEN RAISE EXCEPTION 'Croatian Second NL is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Estonia','Esiliiga B') THEN RAISE EXCEPTION 'Estonian Esiliiga B is tier 3'; END IF;
  IF public.moneyball_is_european_top_two_league('Greece','Football League') THEN RAISE EXCEPTION 'Greek Football League is not current tier 2'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Scotland','Championship') THEN RAISE EXCEPTION 'Scottish Championship must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Turkey','1. Lig') THEN RAISE EXCEPTION 'Turkish 1. Lig must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Denmark','1. Division') THEN RAISE EXCEPTION 'Danish 1. Division must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Norway','1. Division') THEN RAISE EXCEPTION 'Norwegian 1. Division must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Sweden','Superettan') THEN RAISE EXCEPTION 'Swedish Superettan must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Belarus','1. Division') THEN RAISE EXCEPTION 'Belarus 1. Division must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Albania','1st Division') THEN RAISE EXCEPTION 'Albanian 1st Division must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Croatia','First NL') THEN RAISE EXCEPTION 'Croatian First NL must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Estonia','Esiliiga A') THEN RAISE EXCEPTION 'Estonian Esiliiga A must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Greece','Super League 2') THEN RAISE EXCEPTION 'Greek Super League 2 must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Andorra','2a Divisió') THEN RAISE EXCEPTION 'Andorra 2a Divisio must remain eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Azerbaijan','Birinci Dasta') THEN RAISE EXCEPTION 'Azerbaijan Birinci Dasta must remain eligible'; END IF;
END $$;
