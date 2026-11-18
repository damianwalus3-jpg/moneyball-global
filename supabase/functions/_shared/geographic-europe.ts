/**
 * Geographic-Europe boundary used by the production football scope.
 * This follows the project's established geographic/UN M49 Europe policy,
 * not the wider UEFA association list. Turkey, Cyprus, Armenia, Azerbaijan,
 * Georgia, Israel and Kazakhstan are intentionally outside this boundary.
 */
const EUROPEAN_COUNTRY_NAMES = new Set([
  "albania","aland islands","andorra","austria","belarus","belgium",
  "bosnia","bosnia and herzegovina","bosnia herzegovina","bulgaria","croatia",
  "czechia","czech republic","denmark","england","estonia","faroe islands",
  "finland","france","germany","gibraltar","greece","guernsey","hungary",
  "iceland","ireland","republic of ireland","isle of man","italy","jersey",
  "kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova",
  "monaco","montenegro","netherlands","north macedonia","macedonia",
  "northern ireland","norway","poland","portugal","romania","russia",
  "san marino","scotland","serbia","slovakia","slovenia","spain","sweden",
  "switzerland","ukraine","wales","united kingdom",
  "united kingdom of great britain and northern ireland","great britain",
  "svalbard and jan mayen","svalbard and jan mayen islands","vatican city","holy see"
]);
const EUROPEAN_COUNTRY_CODES = new Set([
  "alb","ala","and","aut","blr","bel","bih","bgr","bul","hrv","cro","cze",
  "dnk","eng","est","fro","fin","fra","deu","ger","gib","grc","gre","ggy",
  "hun","isl","irl","imn","ita","jey","kos","lva","lie","ltu","lux","mlt",
  "mda","mco","mne","nld","mkd","nir","nor","pol","prt","por","rou","rus",
  "smr","srb","sco","svk","svn","esp","swe","che","sui","ukr","wal","gbr",
  "gb","uk","vat","sjm"
]);
function normalizeCountry(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function isGeographicEuropeCountry(value: unknown): boolean {
  const raw = String(value ?? "");
  return [raw, ...raw.split(/[|,/]/g)].some((candidate) => {
    const normalized = normalizeCountry(candidate);
    return EUROPEAN_COUNTRY_NAMES.has(normalized) || EUROPEAN_COUNTRY_CODES.has(normalized);
  });
}
