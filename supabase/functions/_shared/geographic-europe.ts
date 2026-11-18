/**
 * Football-Europe geography boundary for fixture ingestion.
 * Includes European countries and UEFA football territories with a European
 * football identity (including Turkey, Cyprus and the Caucasus). Israel and
 * Kazakhstan remain outside this geographic domestic-league scope.
 */
const EUROPEAN_COUNTRY_NAMES = new Set([
  "albania", "andorra", "armenia", "austria", "azerbaijan", "belarus", "belgium",
  "bosnia", "bosnia and herzegovina", "bosnia herzegovina", "bulgaria", "croatia",
  "cyprus", "czechia", "czech republic", "denmark", "england", "estonia",
  "faroe islands", "finland", "france", "georgia", "germany", "gibraltar",
  "greece", "guernsey", "hungary", "iceland", "ireland", "republic of ireland",
  "isle of man", "italy", "jersey", "kosovo", "latvia", "liechtenstein",
  "lithuania", "luxembourg", "malta", "moldova", "monaco", "montenegro",
  "netherlands", "north macedonia", "macedonia", "northern ireland", "norway",
  "poland", "portugal", "romania", "russia", "san marino", "scotland", "serbia",
  "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "türkiye",
  "ukraine", "wales", "united kingdom",
  "united kingdom of great britain and northern ireland", "great britain", "uk",
  "aland islands", "svalbard and jan mayen islands", "holy see", "vatican city",
]);
const EUROPEAN_COUNTRY_CODES = new Set([
  "alb", "and", "arm", "aut", "aze", "blr", "bel", "bih", "bgr", "bul", "hrv", "cro",
  "cyp", "cze", "dnk", "est", "fro", "fin", "fra", "geo", "deu", "ger", "gib", "grc",
  "gre", "ggy", "hun", "isl", "irl", "imn", "ita", "jey", "lva", "lie", "ltu", "lux",
  "mlt", "mda", "mco", "mne", "nld", "mkd", "nor", "pol", "prt", "por", "rou", "rus",
  "smr", "srb", "svk", "svn", "esp", "swe", "che", "sui", "tur", "ukr", "gbr", "gb",
  "uk", "eng", "sco", "wal", "nir", "kos", "ala", "sjm", "vat",
]);
function normalizeCountry(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function isGeographicEuropeCountry(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  const normalized = normalizeCountry(raw);
  if (EUROPEAN_COUNTRY_NAMES.has(normalized) || EUROPEAN_COUNTRY_CODES.has(normalized)) return true;
  return raw.split(/[\\/,;|]+/).some((part) => {
    const token = normalizeCountry(part);
    return EUROPEAN_COUNTRY_NAMES.has(token) || EUROPEAN_COUNTRY_CODES.has(token);
  });
}
