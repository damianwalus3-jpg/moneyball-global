import { isGeographicEuropeCountry } from "./geographic-europe.ts";

const normalizeCompetition = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function isUefaNationsLeagueCompetition(competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  return /\buefa\b/.test(label) && /\bnations league\b/.test(label);
}

const OUT_OF_SCOPE_COMPETITION = /\b(?:uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|friendly|qualif(?:ication|ier)|cup|copa|coppa|kupa|kup|puchar|cupa|taca|supercopa|supercoppa|supercup|coupe|pokal|trophy|shield|women|womens|woman|female|frauen|feminine|femminile|femenina|ladies|girls|youth|academy|reserve|reserves|development|premier league 2|summer series|reserve league|u(?:15|16|17|18|19|20|21|23)|under ?(?:15|16|17|18|19|20|21|23))\b/;
const DOMESTIC_LEAGUE_MARKER = /\b(?:league|liga|liqa|lliga|ligue|division|divisao|divisie|bundesliga|premiership|premier|championship|superliga|super lig|serie|national|regional|regionalliga|oberliga|esiliiga|meistriliiga|virsliga|eliteserien|allsvenskan|superettan|ekstraklasa|mfl|cfl|nl|lyga|liiga|deild|kakkonen|ykkosliiga|ykkonen|toplyga|dasta|ligat|campionato|superiore|meistaradeildin|besta deild|urvalsdeild|honneur|cymru|federation|federacao|federacija|kategoria|1st|2nd|3rd|first|second|third)\b/;
const TOP_TWO_COMPETITION = /\b(?:premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|austrian 2 liga|2 liga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|primera division|segunda division|segunda liga|segunda divisao|liga portugal 2|liga portugal|eredivisie|eerste divisie|keuken kampioen divisie|primeira liga|ekstraklasa|i liga|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|liga e pare|prva liga|first league|second league|fnl|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|1 lyga|i lyga|1 snl|virsliga|meistriliiga|esiliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|1 divisjon|premier division|league of ireland premier|league of ireland first|scottish championship|challenge league|tff first league|national football league|football league|nb i|nb ii|nemzeti bajnoksag i|nemzeti bajnoksag ii|kategoria superiore|kategoria e pare|premyer liqa|i liqa|1 deild|cymru premier|cymru north|cymru south|erovnuli liga|e rovnuli liga|erovnuli liga 2|first nl|prva nl|2 snl|persha liga|first professional football league|second professional football league|bulgarian second league|first division a|first division b|1 division|2 division|divizia nationala|divizia a|1a divisio|2a divisio|primera divisio|segunda divisio|albanian superliga|armenian premier league|belarusian premier league|belarusian first league|premijer liga|first professional league|meistaradeildin|besta deild|urvalsdeild|national division|super liga|super liga 2|super liga Srbije|superliga kosovo|campionato sammarinese|2 mfl|vtora mfl|prva makedonska|super league greece|super liga romania|liga 1 romania|liga 2 romania|montenegro first league|azerbaijan premier league|premyer liqasi|super league albania|lliga multisegur assegurances|lliga grup pirineu|abissnet superiore|bgl ligue|promotion d honneur|albi mall superliga|vbet malta premier league|malta premier league|czech liga|vysshaya liga|pervaya liga|birinci dasta|birinci liqa|azerbaijan first division|azerbaijan first league|liga leumit|ligat haal|ligat ha al|israeli national league|kazakhstan first division|kazakhstan first league|qazaqstan first league|division d honneur|luxembourg division of honour|division of honour|moldovan super liga|moldova liga 1|liga 1 moldova|liga 7777|ligat winner|winner league|meistaradeildin|meistara deildin|lengjudeild karla|1 deild menn|montenegrin second league|second league montenegro|meridianbet 1 cfl|prva mfl|first mfl|wwin liga bih|wwin liga bosne i hercegovine|first league federation of bih|first league of the federation of bih|first league of republika srpska|prva liga federacije bih|prva liga republike srpska|prva liga republike srpske|efbet liga|efbet league|toplyga|cyprus second division|cypriot second division|cyprus league b|league b cyprus|1 deild karla|league of ireland first division|league of ireland premier division|nifl championship|nifl premiership|gibraltar football league|gibraltar second division|malta challenge league|challenge league malta|premier league malta|superliga e shqiperise|armenian first league|bosnian premier league|premijer liga bih|croatian first football league|first football league croatia|prva nogometna liga|czech first league|chance liga|dansk superliga|superligaen|danish 1st division|danish first division|finnish first division|greek super league|premier division ireland|island premier league|israeli premier league|lithuanian a lyga|lithuanian i lyga|latvian higher league|latvian first league|maltese premier league|maltese challenge league|norwegian first division|serbian super liga|slovak first football league|nike liga|prva slovenska nogometna liga|druga slovenska nogometna liga|swiss super league|swiss challenge league|turkish first league|ukrainian premier league|welsh premier league)\b/;
const TOP_TWO_EXCLUSIONS = /\b(?:national [2-5]|serie c|serie d|lega pro|serie c1|serie c2|league one|league two|league three|premier league 2|pl2|professional development league|u(?:17|18|19|20|21|23)|under ?(?:17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|rfef|cup|copa|trophy|play ?offs?|women|woman|female|frauen|damen|feminine|femminile|femenina|ladies|girls|damallsvenskan|wsl|liga f|summer series|druha liga|(?:3|4|5|6|7|8|9|iii|iv|v|vi)\s*\.?\s*(?:liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)|third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\b/i;

/** Broad source-inventory helper: senior men's domestic league tiers only. */
export function isEligibleDomesticSeniorLeague(country: unknown, competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  if (!label || !isGeographicEuropeCountry(country)) return false;
  if (isUefaNationsLeagueCompetition(competition) || OUT_OF_SCOPE_COMPETITION.test(label)) return false;
  return DOMESTIC_LEAGUE_MARKER.test(label) || TOP_TWO_COMPETITION.test(label);
}

/** OpenMatchday source scope: its published catalogue currently contains tiers 1 and 2 only. */
export function isEligibleDomesticTopTwoLeague(country: unknown, competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  const countryKey = normalizeCompetition(country);
  if (!label || !isGeographicEuropeCountry(country)) return false;
  if (isUefaNationsLeagueCompetition(competition) || OUT_OF_SCOPE_COMPETITION.test(label) || TOP_TWO_EXCLUSIONS.test(label)) return false;
  if (["scotland","sco"].includes(countryKey) && /\b(?:lowland league|highland league)\b/.test(label)) return false;
  if (["denmark","dnk","norway","nor","belarus","blr"].includes(countryKey) && /\b2 division\b/.test(label)) return false;
  if (["denmark","dnk"].includes(countryKey) && /\b2nd division\b/.test(label)) return false;
  if (["russia","rus","belarus","blr"].includes(countryKey) && /\bsecond league\b/.test(label)) return false;
  if (["spain","esp"].includes(countryKey) && /\b(?:primera division rfef|segunda division rfef)\b/.test(label)) return false;
  if (["switzerland","sui","che"].includes(countryKey) && /\b1 liga (?:promotion|classic)\b/.test(label)) return false;
  if (["sweden","swe"].includes(countryKey) && /\bdivision [12]\b/.test(label)) return false;
  if (["albania","alb"].includes(countryKey) && /\b2nd division\b/.test(label)) return false;
  if (["croatia","cro"].includes(countryKey) && /\bsecond nl\b/.test(label)) return false;
  if (["estonia","est"].includes(countryKey) && /\besiliiga b\b/.test(label)) return false;
  if (["greece","gre","grc"].includes(countryKey) && /\bfootball league\b/.test(label)) return false;
  if (["poland","pol"].includes(countryKey) && /\b(?:ii|2) liga\b/.test(label)) return false;
  return TOP_TWO_COMPETITION.test(label);
}/** OpenMatchday folders encode the competition tier explicitly (COUNTRY_TIER_NAME). */
export function isEligibleOpenMatchdayTier(value: unknown): boolean {
  const folder = String(value ?? "").replace(/^om:/i, "").split(":")[0].trim();
  const match = folder.match(/^[A-Z]{3}_([1-9][0-9]*)_[A-Z0-9-]+$/i);
  if (!match) return false;
  const tier = Number(match[1]);
  return tier >= 1 && tier <= 2 && !/(?:cup|women|womens|female|youth|academy|reserve|reserves|u(?:15|16|17|18|19|20|21|23))/i.test(folder);
}
