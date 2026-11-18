import { isGeographicEuropeCountry } from "./geographic-europe.ts";

const normalizeCompetition = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function isUefaNationsLeagueCompetition(competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  return /^uefa (?:womens? s )?nations league(?: .*)?$/.test(label)
    || /^uefa womens nations league(?: .*)?$/.test(label);
}

/**
 * Backwards-compatible name: now accepts all European domestic league tiers,
 * all genders and reserve sides, plus UEFA Nations League. Youth tournaments,
 * cups, qualifiers, other international events and friendlies remain excluded.
 */
export function isEligibleDomesticSeniorLeague(country: unknown, competition: unknown): boolean {
  const label = normalizeCompetition(competition);
  if (!label) return false;
  if (isUefaNationsLeagueCompetition(competition)) return true;
  if (!isGeographicEuropeCountry(country)) return false;

  if (/\b(cup|copa|coppa|supercopa|supercoppa|supercup|coupe|pokal|trophy|shield|super cup|taca|kupa|kup|puchar|cupa)\b/.test(label)) return false;
  if (/\b(uefa|fifa|champions league|europa league|conference league|world cup|euro|international|national team|qualif(?:ication|ying|ier)|friendly|friendlies)\b/.test(label)) return false;
  if (/\b(youth|juniors?|academy|juvenil|jugend|u(?:[0-9]{1,2})|under ?(?:[0-9]{1,2})|professional development league|development league|elite league|premier league 2|pl2)\b/.test(label)) return false;

  return /\b(league|liga|ligue|lig|division|divis|serie|bundesliga|eredivisie|premier|championship|superliga|premiership|ekstraliga|ekstraklasa|oberliga|regionalliga|national|deild|virsliga|meistriliiga|veikkausliiga|allsvenskan|superettan|eliteserien|toppserien|kakkonen|ykkosliiga|lowland|highland|non league|first league|second league|third league|first division|second division|third division|division 1|division 2|division 3|league one|league two|prva|hnl|cfl|mfl|snl|campionato|superiore|meistaradeildin|toplyga|nb i|nb ii|nb iii|lliga|second nl)\b/.test(label);
}
