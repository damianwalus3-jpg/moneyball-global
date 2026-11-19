import { scanTodayEuropeanFixtures, fixtureKey, isDomesticLeagueFixture } from "../src/free-fixtures.ts";
import { EUROPEAN_COUNTRY_CODES } from "../src/european-countries.ts";
import { getSourceDiagnostics } from "../src/source-diagnostics.ts";

const scan = await scanTodayEuropeanFixtures(true);
const fixtures = scan.fixtures;
const diagnostics = getSourceDiagnostics(scan);
const scopeAudit = scan.scopeAudit ?? {
  dateAndEuropeFixturesBeforeCompetitionScope: fixtures.length,
  eligibleDomesticLeagueFixtures: fixtures.length,
  excludedOutOfScopeFixtures: 0,
  excludedByReason: {},
  excludedCompetitions: [],
};
const sourceHealth = Object.fromEntries(diagnostics.map(row => [
  row.name,
  row.checked > 0 && row.status !== "ERROR" && row.status !== "BRAK DANYCH",
]));
const sourceHealthCount = Object.values(sourceHealth).filter(Boolean).length;
const requiredSourcesHealthy = sourceHealth["Flashscore"] === true && sourceHealth["FootyNomad"] === true;
const sourceObservationCountBeforeScope = diagnostics.reduce((sum, row) => sum + (row.preScopeFixtures ?? 0), 0);
const eligibleSourceObservationCount = diagnostics.reduce((sum, row) => sum + row.acceptedFixtures, 0);
const duplicateSourceObservationsBeforeScope = Math.max(0, sourceObservationCountBeforeScope - scopeAudit.dateAndEuropeFixturesBeforeCompetitionScope);
const duplicateSourceObservationsAfterScope = Math.max(0, eligibleSourceObservationCount - fixtures.length);
const canonicalKeys = fixtures.map(fixture => fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition));
const duplicateCanonicalKeys = canonicalKeys.length - new Set(canonicalKeys).size;
const wrongDateFixtures = fixtures.filter(fixture => fixture.date !== scan.date).length;
const nonEuropeanFixtures = fixtures.filter(fixture => fixture.countryCode === "UEFA" || !EUROPEAN_COUNTRY_CODES.has(fixture.countryCode)).length;
const outOfScopeFixtures = fixtures.filter(fixture => !isDomesticLeagueFixture(fixture)).length;
const countrySummary = [...new Set(fixtures.map(fixture => fixture.countryCode))]
  .sort()
  .map(countryCode => ({ countryCode, fixtures: fixtures.filter(fixture => fixture.countryCode === countryCode).length }));
const competitionMap = new Map<string, { countryCode: string; competition: string; fixtures: number }>();
for (const fixture of fixtures) {
  const key = fixture.countryCode + "|" + fixture.competition;
  const entry = competitionMap.get(key) ?? { countryCode: fixture.countryCode, competition: fixture.competition, fixtures: 0 };
  entry.fixtures++;
  competitionMap.set(key, entry);
}
const competitionSummary = [...competitionMap.values()].sort((a, b) =>
  b.fixtures - a.fixtures || a.countryCode.localeCompare(b.countryCode) || a.competition.localeCompare(b.competition));
const sourceErrorCount = diagnostics.reduce((sum, row) => sum + row.errors, 0);
const degradedSources = diagnostics.filter(row => row.status === "ERROR" || row.status === "BRAK DANYCH").map(row => row.name);
const zeroResultSources = diagnostics.filter(row => row.status === "ODPOWIEDŹ · 0 MECZÓW").map(row => row.name);
const generatedAtAgeSeconds = Math.max(0, Math.round((Date.now() - Date.parse(scan.generatedAt)) / 1000));
const generatedAtFresh = Number.isFinite(generatedAtAgeSeconds) && generatedAtAgeSeconds <= 300;
const success = fixtures.length > 0 && sourceHealthCount >= 6 && requiredSourcesHealthy
  && duplicateCanonicalKeys === 0 && wrongDateFixtures === 0 && nonEuropeanFixtures === 0
  && outOfScopeFixtures === 0 && generatedAtFresh;

const report = {
  success,
  date: scan.date,
  timezone: "Europe/Brussels",
  generatedAt: scan.generatedAt,
  scope: "Wyłącznie bieżący dzień Brussels; krajowe ligi europejskie wszystkich poziomów udostępnianych przez źródła. Bez krajowych pucharów, UEFA i rozgrywek międzynarodowych. Kobiety, młodzież i rezerwy pozostają, jeśli są ligą krajową i źródło je udostępnia.",
  totalUniqueFixtures: fixtures.length,
  countries: countrySummary.length,
  competitions: competitionSummary.length,
  countrySummary,
  competitionSummary,
  scopeAudit,
  sourceObservationCountBeforeScope,
  uniqueDateFixturesBeforeScope: scopeAudit.dateAndEuropeFixturesBeforeCompetitionScope,
  duplicateSourceObservationsBeforeScope,
  eligibleSourceObservationCount,
  duplicateSourceObservationsAfterScope,
  sourceSummary: diagnostics.map(row => ({
    source: row.name, checked: row.checked, rawEntries: row.rawRecords,
    preScopeFixtures: row.preScopeFixtures, eligibleFixtures: row.acceptedFixtures,
    errors: row.errors, status: row.status, detail: row.detail,
  })),
  sourceHealth,
  sourceHealthCount,
  requiredSourcesHealthy,
  degradedSources,
  zeroResultSources,
  sourceErrorCount,
  sourceErrors: scan.leaguesFailed,
  validation: {
    duplicateCanonicalKeys, wrongDateFixtures, nonEuropeanFixtures, outOfScopeFixtures,
    generatedAtAgeSeconds, generatedAtFresh,
  },
  completeness: {
    provenComplete: false,
    note: "To jest wieloźródłowy snapshot, nie dowód kompletności wszystkich federacji i poziomów. Cztery adaptery nie udostępniają surowej liczby rekordów; N/D pozostaje N/D. Zero meczów z poprawnie sprawdzonego źródła nie jest błędem.",
  },
};

console.log(JSON.stringify(report, null, 2));
if (!success) process.exitCode = 1;
