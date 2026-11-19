import type { FixtureScan } from "./free-fixtures";

export interface SourceDiagnostic {
  name: string;
  checked: number;
  rawRecords: number | null;
  preScopeFixtures: number | null;
  acceptedFixtures: number;
  errors: number;
  catalogue?: string;
  detail: string;
  status: "ERROR" | "BRAK DANYCH" | "ODPOWIEDŹ · 0 MECZÓW" | "MECZE ZNALEZIONE";
}

export function getSourceDiagnostics(scan: FixtureScan): SourceDiagnostic[] {
  const c = scan.coverage;
  const rows: Array<Omit<SourceDiagnostic, "status">> = [
    { name: "OpenMatchday", checked: c.openMatchday.cataloguesChecked, rawRecords: null,
      preScopeFixtures: c.openMatchday.dateQualifiedBeforeScope ?? c.openMatchday.fixtures,
      acceptedFixtures: c.openMatchday.fixtures, errors: c.openMatchday.errors,
      catalogue: `katalogi: ${c.openMatchday.cataloguesChecked}`,
      detail: `Przed filtrem pucharów/UEFA: ${c.openMatchday.dateQualifiedBeforeScope ?? c.openMatchday.fixtures}; adapter nie udostępnia surowej liczby wierszy CSV.` },
    { name: "OpenLigaDB", checked: c.openLigaDB.competitionsChecked, rawRecords: null,
      preScopeFixtures: c.openLigaDB.dateQualifiedBeforeScope ?? c.openLigaDB.fixtures,
      acceptedFixtures: c.openLigaDB.fixtures, errors: c.openLigaDB.errors,
      catalogue: `rozgrywki: ${c.openLigaDB.competitionsChecked}`,
      detail: `Przed filtrem pucharów/UEFA: ${c.openLigaDB.dateQualifiedBeforeScope ?? c.openLigaDB.fixtures}; adapter nie udostępnia surowej liczby rekordów.` },
    { name: "OpenFootball", checked: c.openFootball.feedsChecked, rawRecords: null,
      preScopeFixtures: c.openFootball.dateQualifiedBeforeScope ?? c.openFootball.fixtures,
      acceptedFixtures: c.openFootball.fixtures, errors: c.openFootball.errors,
      catalogue: `pliki: ${c.openFootball.feedsChecked}`,
      detail: `Przed filtrem pucharów/UEFA: ${c.openFootball.dateQualifiedBeforeScope ?? c.openFootball.fixtures}; adapter raportuje tylko poprawne parsowanie.` },
    { name: "ESPN", checked: c.espn.scoreboardsChecked, rawRecords: null,
      preScopeFixtures: c.espn.dateQualifiedBeforeScope ?? c.espn.fixtures,
      acceptedFixtures: c.espn.fixtures, errors: c.espn.errors,
      catalogue: `scoreboardy: ${c.espn.scoreboardsChecked}`,
      detail: `Przed filtrem pucharów/UEFA: ${c.espn.dateQualifiedBeforeScope ?? c.espn.fixtures}; adapter nie udostępnia pełnej surowej liczby zdarzeń.` },
    { name: "FootyNomad", checked: c.footyNomad.pagesChecked, rawRecords: c.footyNomad.pageMatches,
      preScopeFixtures: c.footyNomad.dateQualifiedBeforeScope ?? c.footyNomad.fixtures,
      acceptedFixtures: c.footyNomad.fixtures, errors: c.footyNomad.errors,
      catalogue: `strony: ${c.footyNomad.pagesChecked}`,
      detail: `Surowe wpisy stron: ${c.footyNomad.pageMatches}; przed filtrem pucharów/UEFA: ${c.footyNomad.dateQualifiedBeforeScope ?? c.footyNomad.fixtures}; bez czasu pominięto: ${c.footyNomad.skippedNoTimestamp}.` },
    { name: "timezone.football", checked: c.timezoneFootball.generatedAt ? 1 : 0, rawRecords: c.timezoneFootball.feedMatches,
      preScopeFixtures: c.timezoneFootball.dateQualifiedBeforeScope ?? c.timezoneFootball.fixtures,
      acceptedFixtures: c.timezoneFootball.fixtures, errors: c.timezoneFootball.errors,
      catalogue: c.timezoneFootball.generatedAt ? `feed: ${c.timezoneFootball.generatedAt}` : "feed bez daty",
      detail: `Surowy feed obejmuje wiele dni: ${c.timezoneFootball.feedMatches}; wpisy po dacie/Europie przed filtrem zakresu: ${c.timezoneFootball.dateQualifiedBeforeScope ?? c.timezoneFootball.fixtures}.` },
    { name: "Flashscore", checked: c.flashscore.competitionsChecked, rawRecords: c.flashscore.rawMatches,
      preScopeFixtures: c.flashscore.dateQualifiedBeforeScope ?? c.flashscore.fixtures,
      acceptedFixtures: c.flashscore.fixtures, errors: c.flashscore.errors,
      catalogue: `rozgrywki: ${c.flashscore.competitionsChecked}`,
      detail: `Surowe wpisy: ${c.flashscore.rawMatches}; przed filtrem pucharów/UEFA: ${c.flashscore.dateQualifiedBeforeScope ?? c.flashscore.fixtures}; poza Europą: ${c.flashscore.skippedNonEuropean}; inna data: ${c.flashscore.skippedWrongDate}; bez czasu: ${c.flashscore.timestampMissing}.` },
    { name: "API-Football Pro", checked: c.apiFootball ? 1 : 0,
      rawRecords: c.apiFootball && c.apiFootball.errors === 0 ? c.apiFootball.providerFixtures : null,
      preScopeFixtures: c.apiFootball && c.apiFootball.errors === 0 ? c.apiFootball.europeanDateFixtures : null,
      acceptedFixtures: c.apiFootball?.eligibleFixtures ?? (c.apiFootball?.errors ? 0 : c.apiFootball?.europeanDateFixtures ?? 0),
      errors: c.apiFootball?.errors ?? 0, catalogue: "feed dzienny",
      detail: c.apiFootball?.errors ? "Brak wiarygodnej liczby wpisów po błędzie dostawcy; szczegół znajduje się w surowym komunikacie błędu."
        : `Surowe mecze dostawcy: ${c.apiFootball?.providerFixtures ?? 0}; po dacie/Europie: ${c.apiFootball?.europeanDateFixtures ?? 0}.` },
    { name: "PitchAPI", checked: c.pitchApi ? 1 : 0, rawRecords: c.pitchApi?.fixtures ?? null,
      preScopeFixtures: c.pitchApi?.europeanFixtures ?? null,
      acceptedFixtures: c.pitchApi?.eligibleFixtures ?? c.pitchApi?.europeanFixtures ?? 0,
      errors: c.pitchApi?.errors ?? 0,
      catalogue: `katalog lig: ${c.pitchApi?.catalogueLeagues ?? 0}; europejskie: ${c.pitchApi?.europeanCatalogueLeagues ?? 0}; bezpłatne: ${c.pitchApi?.freeEuropeanCatalogueLeagues ?? 0}`,
      detail: `Surowy feed dzienny: ${c.pitchApi?.fixtures ?? 0}; po dacie/Europie: ${c.pitchApi?.europeanFixtures ?? 0}; z katalogu na dziś: ${c.pitchApi?.catalogueDateFixtures ?? 0}; płatne ligi pominięte: ${c.pitchApi?.skippedNonFreeCatalogueLeagues ?? 0}.` },
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
