import { isGeographicEuropeCountry } from "./geographic-europe.ts";

export function isEligibleDomesticSeniorLeague(country: unknown, competition: unknown): boolean {
  if (!isGeographicEuropeCountry(country)) return false;
  const label = String(competition ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!label) return false;
  if (/\b(uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|qualif(?:ication|ying)|friendlies?)\b/.test(label)) return false;
  if (/\b(cup|copa|coppa|coupe|pokal|trophy|shield|super cup|taca|kupa|kup|puchar|cupa|play ?offs?)\b/.test(label)) return false;
  if (/\b(women|womens|woman|frauen|femenina|femenino|feminin|female|damen|ladies|girls|damallsvenskan|wsl|liga f|summer series|u(?:[0-9]{1,2})|under ?(?:[0-9]{1,2})|youth|juniors?|academy|juvenil|jugend|premier league 2|pl2|professional development league)\b/.test(label)) return false;
  return true;
}
