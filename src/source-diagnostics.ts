import type { FixtureScan } from "./free-fixtures";

export interface SourceDiagnostic {
  name: string;
  checked: number;
  rawRecords: number;
  acceptedFixtures: number;
  errors: number;
  catalogue?: string;
  detail: string;
  status: "ERROR" | "BRAK DANYCH" | "ODPOWIEDŹ · 0 MECZÓW" | "MECZE ZNALEZIONE";
}

export function getSourceDiagnostics(scan: FixtureScan): SourceDiagnostic[] {
  const c = scan.coverage;
  const rows: Array<Omit<SourceDiagnostic, "status">> = [
    { name: "OpenMatchday", checked: c.openMatchday.cataloguesChecked, rawRecords: c.openMatchday.fixtures, acceptedFixtures: c.openMatchday.fixtures, errors: c.openMatchday.errors, catalogue: `katalogi: ${c.openMatchday.cataloguesChecked}`, detail: "Liczba meczów po filtrze daty i rozgrywek." },
    { name: "OpenLigaDB", checked: c.openLigaDB.competitionsChecked, rawRecords: c.openLigaDB.fixtures, acceptedFixtures: c.openLigaDB.fixtures, errors: c.openLigaDB.errors, catalogue: `rozgrywki: ${c.openLigaDB.competitionsChecked}`, detail: "Mecze z rozpoznanych europejskich rozgrywek." },
    { name: "OpenFootball", checked: c.openFootball.feedsChecked, rawRecords: c.openFootball.fixtures, acceptedFixtures: c.openFootball.fixtures, errors: c.openFootball.errors, catalogue: `pliki: ${c.openFootball.feedsChecked}`, detail: "Mecze odczytane z plików wyników/terminarzy." },
    { name: "ESPN", checked: c.espn.scoreboardsChecked, rawRecords: c.espn.fixtures, acceptedFixtures: c.espn.fixtures, errors: c.espn.errors, catalogue: `scoreboardy: ${c.espn.scoreboardsChecked}`, detail: "Mecze przyjęte po normalizacji daty i federacji." },
    { name: "FootyNomad", checked: c.footyNomad.pagesChecked, rawRecords: c.footyNomad.pageMatches, acceptedFixtures: c.footyNomad.fixtures, errors: c.footyNomad.errors, catalogue: `strony: ${c.footyNomad.pagesChecked}`, detail: `Wpisy na stronach: ${c.footyNomad.pageMatches}; bez czasu pominięto: ${c.footyNomad.skippedNoTimestamp}.` },
    { name: "timezone.football", checked: c.timezoneFootball.generatedAt ? 1 : 0, rawRecords: c.timezoneFootball.feedMatches, acceptedFixtures: c.timezoneFootball.fixtures, errors: c.timezoneFootball.errors, catalogue: c.timezoneFootball.generatedAt ? `feed: ${c.timezoneFootball.generatedAt}` : "feed bez daty", detail: "Surowy feed obejmuje wiele dni; przyjęte mecze dotyczą wyłącznie dnia skanu." },
    { name: "Flashscore", checked: c.flashscore.competitionsChecked, rawRecords: c.flashscore.rawMatches, acceptedFixtures: c.flashscore.fixtures, errors: c.flashscore.errors, catalogue: `rozgrywki: ${c.flashscore.competitionsChecked}`, detail: `Poza Europą: ${c.flashscore.skippedNonEuropean}; inna data: ${c.flashscore.skippedWrongDate}; bez czasu: ${c.flashscore.timestampMissing}.` },
    { name: "API-Football Pro", checked: c.apiFootball?.providerFixtures ? 1 : 0, rawRecords: c.apiFootball?.providerFixtures ?? 0, acceptedFixtures: c.apiFootball?.europeanDateFixtures ?? 0, errors: c.apiFootball?.errors ?? 0, catalogue: "feed dzienny", detail: "Surowe mecze dostawcy kontra mecze europejskie w dacie brukselskiej." },
    { name: "PitchAPI", checked: c.pitchApi?.catalogueLeagues ?? 0, rawRecords: c.pitchApi?.catalogueUpcomingFixtures ?? 0, acceptedFixtures: c.pitchApi?.europeanFixtures ?? 0, errors: c.pitchApi?.errors ?? 0, catalogue: `katalog lig: ${c.pitchApi?.catalogueLeagues ?? 0}; europejskie: ${c.pitchApi?.europeanCatalogueLeagues ?? 0}; bezpłatne: ${c.pitchApi?.freeEuropeanCatalogueLeagues ?? 0}`, detail: `Wyniki feedu dziennego: ${c.pitchApi?.fixtures ?? 0}; z katalogu na dziś: ${c.pitchApi?.catalogueDateFixtures ?? 0}; płatne ligi pominięte: ${c.pitchApi?.skippedNonFreeCatalogueLeagues ?? 0}.` },
  ];
  return rows.map(row => ({
    ...row,
    status: row.errors > 0 ? "ERROR"
      : row.checked === 0 ? "BRAK DANYCH"
      : row.acceptedFixtures === 0 ? "ODPOWIEDŹ · 0 MECZÓW"
      : "MECZE ZNALEZIONE",
  }));
}

export function summarizeFixtureCoverage(scan: FixtureScan): { countries: number; competitions: number; countryCodes: string[] } {
  const countryCodes = [...new Set(scan.fixtures.map(item => item.countryCode))].sort();
  return {
    countries: countryCodes.length,
    competitions: new Set(scan.fixtures.map(item => item.countryCode + "|" + item.competition)).size,
    countryCodes,
  };
}
