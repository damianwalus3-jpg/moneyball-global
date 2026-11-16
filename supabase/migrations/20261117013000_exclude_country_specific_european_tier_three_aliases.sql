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

