import { EUROPEAN_COUNTRY_CODES } from "../src/european-countries.ts";
import { fixtureKey } from "../src/free-fixtures.ts";

const WORKER_BASE = "https://moneyball-global-rebuild.damianwalus3.workers.dev";
const values = new Map<string, string>();
const storage = {
  get length() { return values.size; },
  clear() { values.clear(); },
  getItem(key: string) { return values.get(key) ?? null; },
  key(index: number) { return [...values.keys()][index] ?? null; },
  removeItem(key: string) { values.delete(key); },
  setItem(key: string, value: string) { values.set(key, String(value)); },
} as Storage;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = input instanceof Request ? input.url : String(input);
  return nativeFetch(new URL(raw, WORKER_BASE), init);
}) as typeof fetch;

const { scanTodayEuropeanFixtures } = await import("../src/free-fixtures.ts");
const scan = await scanTodayEuropeanFixtures(true);
const countryRows = new Map<string, { fixtures: number; competitions: Set<string>; sources: Set<string> }>();
for (const fixture of scan.fixtures) {
  const row = countryRows.get(fixture.countryCode) ?? { fixtures: 0, competitions: new Set<string>(), sources: new Set<string>() };
  row.fixtures++;
  row.competitions.add(fixture.competition);
  for (const source of fixture.source.split(" + ").map(value => value.trim()).filter(Boolean)) row.sources.add(source);
  countryRows.set(fixture.countryCode, row);
}
const countrySummary = [...countryRows.entries()].map(([countryCode, row]) => ({
  countryCode, fixtures: row.fixtures, competitions: row.competitions.size, sources: [...row.sources].sort(),
})).sort((a, b) => b.fixtures - a.fixtures || a.countryCode.localeCompare(b.countryCode));
const sourceHasErrors = (prefix: string) => scan.leaguesFailed.some(error => error.toLowerCase().startsWith(prefix.toLowerCase()));
const sourceHealth = {
  openMatchday: scan.coverage.openMatchday.cataloguesChecked > 0 && !sourceHasErrors("open-matchday ·"),
  openLigaDB: scan.coverage.openLigaDB.competitionsChecked > 0 && !sourceHasErrors("OpenLigaDB ·"),
  openFootball: scan.coverage.openFootball.feedsChecked > 0 && !sourceHasErrors("openfootball ·"),
  ESPN: scan.coverage.espn.scoreboardsChecked > 0 && !sourceHasErrors("ESPN "),
  FootyNomad: scan.coverage.footyNomad.pagesChecked > 0 && !sourceHasErrors("FootyNomad ·"),
  timezoneFootball: Boolean(scan.coverage.timezoneFootball.generatedAt) && !sourceHasErrors("timezone.football ·"),
  Flashscore: scan.coverage.flashscore.competitionsChecked > 0 && !sourceHasErrors("Flashscore ·"),
  PitchAPI: (scan.coverage.pitchApi?.catalogueLeagues ?? 0) > 0 && !sourceHasErrors("PitchAPI"),
};
const canonicalKeys = scan.fixtures.map(fixture => fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition));
const duplicateKeys = canonicalKeys.filter((key, index) => canonicalKeys.indexOf(key) !== index);
const wrongDate = scan.fixtures.filter(fixture => fixture.date !== scan.date);
const nonEuropean = scan.fixtures.filter(fixture => !EUROPEAN_COUNTRY_CODES.has(fixture.countryCode) && !["EU", "UEFA"].includes(fixture.countryCode));
const generatedAtMs = Date.parse(scan.generatedAt);
const generatedAtAgeSeconds = Math.round((Date.now() - generatedAtMs) / 1000);
const scanTimestampFresh = Number.isFinite(generatedAtMs) && generatedAtAgeSeconds >= 0 && generatedAtAgeSeconds <= 300;
const catalogueGeneratedAtMs = Date.parse(scan.coverage.openMatchday.catalogueGeneratedAt);
const catalogueAgeHours = Number.isFinite(catalogueGeneratedAtMs)
  ? Math.round((Date.now() - catalogueGeneratedAtMs) / 3_600_000 * 10) / 10 : null;
const timezoneGeneratedAtMs = Date.parse(scan.coverage.timezoneFootball.generatedAt);
const timezoneAgeHours = Number.isFinite(timezoneGeneratedAtMs)
  ? Math.round((Date.now() - timezoneGeneratedAtMs) / 3_600_000 * 10) / 10 : null;
const openMatchdayCatalogueFresh = catalogueAgeHours !== null && catalogueAgeHours >= 0 && catalogueAgeHours <= 24;
const timezoneFootballFeedFresh = timezoneAgeHours !== null && timezoneAgeHours >= 0 && timezoneAgeHours <= 24;
const degradedSources = Object.entries(sourceHealth).filter(([, healthy]) => !healthy).map(([source]) => source);
const sourceErrorCount = scan.leaguesFailed.length;
const requiredSourcesHealthy = sourceHealth.Flashscore && sourceHealth.FootyNomad;
const report = {
  dateEuropeBrussels: scan.date,
  generatedAt: scan.generatedAt,
  freshness: {
    scanTimestampFresh,
    scanAgeSeconds: generatedAtAgeSeconds,
    openMatchdayCatalogueAgeHours: catalogueAgeHours,
    openMatchdayCatalogueFresh,
    timezoneFootballFeedAgeHours: timezoneAgeHours,
    timezoneFootballFeedFresh,
  },
  totalUniqueFixtures: scan.fixtures.length,
  countries: countrySummary.length,
  competitions: new Set(scan.fixtures.map(fixture => fixture.countryCode + "|" + fixture.competition)).size,
  sourceHealth,
  sourceHealthCount: Object.values(sourceHealth).filter(Boolean).length,
  degradedSources,
  sourceErrorCount,
  requiredSourcesHealthy,
  sourceCoverage: scan.coverage,
  countrySummary,
  errors: scan.leaguesFailed,
  validation: { duplicateCanonicalKeys: duplicateKeys.length, wrongDateFixtures: wrongDate.length, nonEuropeanFixtures: nonEuropean.length },
  limitation: "This is a live multi-source snapshot, not proof that every European federation, youth, women's or amateur competition is represented.",
};
console.log("MONEYBALL REBUILT LIVE EUROPE FIXTURE AUDIT");
console.log(JSON.stringify(report, null, 2));
if (!scanTimestampFresh || !openMatchdayCatalogueFresh || !timezoneFootballFeedFresh
  || !requiredSourcesHealthy || Object.values(sourceHealth).filter(Boolean).length < 6
  || !scan.fixtures.length || duplicateKeys.length || wrongDate.length || nonEuropean.length) {
  throw new Error("Live fixture audit failed validation; inspect the source and country diagnostics above.");
}
