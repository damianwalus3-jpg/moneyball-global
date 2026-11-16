-- Normalize local-language league names and exclude cup competitions from dashboard scope.
CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text, p_competition text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH normalized AS (
    SELECT translate(lower(coalesce(p_competition,'')), 'áéíóúüñç', 'aeiouunc') AS comp
  )
  SELECT
    lower(coalesce(p_country,'')) = ANY (ARRAY[
      'albania','andorra','armenia','austria','azerbaijan','belarus','belgium','bosnia and herzegovina',
      'bulgaria','croatia','cyprus','czechia','czech republic','denmark','england','estonia','faroe islands',
      'finland','france','georgia','germany','gibraltar','greece','hungary','iceland','ireland','isle of man',
      'italy','kazakhstan','kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova',
      'monaco','montenegro','netherlands','north macedonia','northern ireland','norway','poland','portugal',
      'romania','russia','san marino','scotland','serbia','slovakia','slovenia','spain','sweden','switzerland',
      'turkey','türkiye','ukraine','wales','united kingdom','uk',
      'alb','and','arm','aut','aze','blr','bel','bih','bul','cro','cyp','cze','dnk','eng','est','fro','fin',
      'fra','geo','deu','ger','gib','grc','gre','hun','isl','irl','ita','kaz','kos','lva','lie','ltu','lux',
      'mlt','mda','mne','nld','mkd','nir','nor','pol','prt','por','rou','rus','smr','sco','srb','svk','svn',
      'esp','swe','che','sui','tur','ukr','wal','gbr','uk'
    ])
    AND normalized.comp <> ''
    AND normalized.comp !~* $youth$(\m(u(17|18|19|20|21|23)|under ?(17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|cup|copa|trophy|play-?offs?)\M)$youth$
    AND normalized.comp !~* $lower$(\m(3|4|5|6|7|8|9|iii|iv|v|vi)\s*\.?\s*(liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)\M|\m(third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\M)$lower$
    AND normalized.comp ~* $top$(\m(premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|segunda division|segunda liga|eredivisie|keuken kampioen divisie|primeira liga|ekstraklasa|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|prva liga|druha liga|persha liga|liga e pare|hnl|1 hnl|2 hnl|first league|second league|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|virsliga|meistriliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|premier division|league of ireland premier|league of ireland first|scottish championship)\M)$top$
  FROM normalized;
$function$;