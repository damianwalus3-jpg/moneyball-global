import { isGeographicEuropeCountry } from "./geographic-europe.ts";

const normalizeCompetition = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function isUefaNationsLeagueCompetition(competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  return /\buefa\b/.test(label) && /\bnations league\b/.test(label);
}

const OUT_OF_SCOPE_COMPETITION = /\b(?:uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|friendly|qualif(?:ication|ier)|cup|copa|coppa|supercopa|supercoppa|supercup|coupe|pokal|trophy|shield|women|womens|woman|female|frauen|feminine|femminile|femenina|ladies|girls|youth|academy|reserve|reserves|development|premier league 2|reserve league|u(?:15|16|17|18|19|20|21|23)|under ?(?:15|16|17|18|19|20|21|23))\b/;
const DOMESTIC_LEAGUE_MARKER = /\b(?:league|liga|ligue|division|divisao|divisie|bundesliga|premiership|premier|championship|superliga|super lig|serie|national|regionalliga|oberliga|esiliiga|meistriliiga|virsliga|eliteserien|allsvenskan|superettan|ekstraklasa|mfl|cfl|nl|lyga|liiga|deild|kup|mistrzostwa|1st|2nd|3rd|first|second|third)\b/;
const TOP_TWO_COMPETITION = /\b(?:premier league|premiership|championship|super league|superliga|super lig|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|primera division|segunda division|primera divisio|segunda divisio|eredivisie|eerste divisie|keuken kampioen divisie|primeira liga|liga portugal|liga portugal 2|segunda liga|segunda divisao|ekstraklasa|i liga|1 liga|2 liga|a lyga|i lyga|1 lyga|2 lyga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|1 divisjon|premier division|league of ireland premier|league of ireland first|scottish championship|challenge league|first division|second division|first league|second league|first professional league|second professional league|first professional football league|second professional football league|national football league|nb i|nb ii|nemzeti bajnoksag i|nemzeti bajnoksag ii|kategoria superiore|kategoria e pare|prva liga|prva nl|first nl|2 snl|1 snl|cymru premier|cymru north|cymru south|erovnuli liga|erovnuli liga 2|persha liga|divizia nationala|liga i|liga ii|liga 1|liga 2|super league 2|super liga|super liga 2|meistaradeildin|besta deild|urvalsdeild|lengjudeild|national division|abissnet superiore|bgl ligue|efbet league|toplyga|liga 7777|meridianbet 1 cfl|prva mfl|wwin liga)\b/i;

/** Broad source-inventory helper: senior men's domestic league tiers only. */
export function isEligibleDomesticSeniorLeague(country: unknown, competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  if (!label || !isGeographicEuropeCountry(country)) return false;
  if (isUefaNationsLeagueCompetition(competition) || OUT_OF_SCOPE_COMPETITION.test(label)) return false;
  return DOMESTIC_LEAGUE_MARKER.test(label);
}

/** Production candidate scope: geographic-Europe domestic men's tiers 1 and 2 only. */
export function isEligibleDomesticTopTwoLeague(country: unknown, competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  const countryKey = normalizeCompetition(country);
  if (!label || !isGeographicEuropeCountry(country)) return false;
  if (isUefaNationsLeagueCompetition(competition) || OUT_OF_SCOPE_COMPETITION.test(label)) return false;
  if (countryKey === "england" && /\b(?:league one|league two|national league|national league north|national league south|non league|istmian|southern league|northern premier)\b/.test(label)) return false;
  if (countryKey === "scotland" && /\b(?:league one|league two|lowland league|highland league|lowland|highland)\b/.test(label)) return false;
  if (countryKey === "germany" && /\b(?:regionalliga|oberliga|landesliga|verbandsliga)\b/.test(label)) return false;
  if (countryKey === "spain" && /\b(?:primera federacion|segunda federacion|tercera federacion|tercera rfef|segunda rfef|tercera division)\b/.test(label)) return false;
  if (countryKey === "france" && /\b(?:national 2|national 3|regional 1|regional 2)\b/.test(label)) return false;
  if (countryKey === "italy" && /\b(?:serie c|serie d)\b/.test(label)) return false;
  if (countryKey === "sweden" && /\b(?:division 1|division 2|division 3)\b/.test(label)) return false;
  if (countryKey === "denmark" && /\b(?:2nd division|2 division|3 division)\b/.test(label)) return false;
  if (countryKey === "switzerland" && /\b(?:1 liga|2 liga|2 liga interregional)\b/.test(label)) return false;
  if (countryKey === "poland" && /\b(?:2 liga|iii liga|iv liga)\b/.test(label)) return false;
  if (countryKey === "croatia" && /\b(?:second nl|third nl)\b/.test(label)) return false;
  if (countryKey === "estonia" && /\besiliiga b\b/.test(label)) return false;
  if (countryKey === "greece" && /\bfootball league\b/.test(label)) return false;
  if (countryKey === "albania" && /\bsecond division\b/.test(label)) return false;
  return TOP_TWO_COMPETITION.test(label);
}

/** OpenMatchday folders encode the competition tier explicitly (COUNTRY_TIER_NAME). */
export function isEligibleOpenMatchdayTier(value: unknown): boolean {
  const folder = String(value ?? "").replace(/^om:/i, "").split(":")[0].trim();
  const match = folder.match(/^[A-Z]{3}_([1-9][0-9]*)_[A-Z0-9-]+$/i);
  if (!match) return false;
  const tier = Number(match[1]);
  return tier >= 1 && tier <= 2 && !/(?:cup|women|womens|female|youth|academy|reserve|reserves|u(?:15|16|17|18|19|20|21|23))/i.test(folder);
}
