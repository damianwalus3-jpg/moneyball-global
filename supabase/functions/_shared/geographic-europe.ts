/**
 * Geographic Europe boundary for football fixture ingestion.
 *
 * Based on UN Statistics Division M49 regional classification. Football
 * associations inside the United Kingdom and Kosovo are explicit provider
 * aliases because feeds publish their domestic leagues separately.
 * Do not infer geography from UEFA membership or competition names.
 */
const EUROPEAN_COUNTRY_NAMES = new Set([
  "albania", "andorra", "austria", "belarus", "belgium",
  "bosnia", "bosnia and herzegovina", "bulgaria", "croatia",
  "czechia", "czech republic", "denmark", "england", "estonia",
  "faroe islands", "finland", "france", "germany", "gibraltar",
  "greece", "guernsey", "hungary", "iceland", "ireland", "republic of ireland",
  "isle of man", "italy", "jersey", "kosovo", "latvia",
  "liechtenstein", "lithuania", "luxembourg", "malta", "moldova",
  "monaco", "montenegro", "netherlands", "north macedonia", "macedonia",
  "northern ireland", "norway", "poland", "portugal", "romania",
  "russia", "san marino", "scotland", "serbia", "slovakia",
  "slovenia", "spain", "sweden", "switzerland", "ukraine", "wales",
  "united kingdom", "united kingdom of great britain and northern ireland", "great britain", "uk",
  "aland islands", "svalbard and jan mayen islands", "holy see", "vatican city",
]);
const EUROPEAN_COUNTRY_CODES = new Set([
  "alb", "and", "aut", "blr", "bel", "bih", "bgr", "bul", "hrv", "cro",
  "cze", "dnk", "est", "fro", "fin", "fra", "deu", "ger", "gib", "grc",
  "gre", "ggy", "hun", "isl", "irl", "imn", "ita", "jey", "lva", "lie",
  "ltu", "lux", "mlt", "mda", "mco", "mne", "nld", "mkd", "nor", "pol",
  "prt", "por", "rou", "rus", "smr", "srb", "svk", "svn", "esp", "swe",
  "che", "sui", "ukr", "gbr", "gb", "uk", "eng", "sco", "wal", "nir",
  "kos", "ala", "sjm", "vat",
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
