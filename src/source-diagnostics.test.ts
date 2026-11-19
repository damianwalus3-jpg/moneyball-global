import { describe, expect, it } from "vitest";
import { getSourceDiagnostics, summarizeFixtureCoverage } from "./source-diagnostics";
import type { FixtureScan } from "./free-fixtures";

const scan = (overrides: Partial<FixtureScan["coverage"]> = {}, fixtures: FixtureScan["fixtures"] = []): FixtureScan => ({
  date: "2026-11-19", generatedAt: "2026-11-19T08:00:00.000Z", fixtures,
  leaguesChecked: 1, leaguesFailed: [], source: "test", cache: false,
  coverage: {
    openMatchday: { cataloguesChecked: 5, fixtures: 0, errors: 0, catalogueGeneratedAt: "2026-11-19T07:00:00.000Z" },
    openLigaDB: { competitionsChecked: 2, fixtures: 1, errors: 0 },
    openFootball: { feedsChecked: 3, fixtures: 0, errors: 0 },
    espn: { scoreboardsChecked: 1, fixtures: 0, errors: 0 },
    footyNomad: { pagesChecked: 2, pageMatches: 12, fixtures: 2, skippedNoTimestamp: 1, errors: 0 },
    timezoneFootball: { feedMatches: 50, fixtures: 0, generatedAt: "2026-11-19T06:00:00.000Z", errors: 0 },
    flashscore: { competitionsChecked: 4, rawMatches: 20, fixtures: 3, skippedNonEuropean: 10, skippedWrongDate: 5, timestampMissing: 2, errors: 0 },
    apiFootball: { providerFixtures: 100, europeanDateFixtures: 6, errors: 0 },
    pitchApi: { fixtures: 10, europeanFixtures: 2, leaguesResolved: 10, catalogueLeagues: 50, europeanCatalogueLeagues: 30, freeEuropeanCatalogueLeagues: 20, skippedNonFreeCatalogueLeagues: 10, catalogueUpcomingFixtures: 40, catalogueDateFixtures: 2, errors: 0 },
    ...overrides,
  },
});

describe("source diagnostics", () => {
  it("distinguishes a successful source with zero relevant fixtures from a source error", () => {
    const rows = getSourceDiagnostics(scan());
    expect(rows.find(row => row.name === "OpenMatchday")?.status).toBe("ODPOWIEDŹ · 0 MECZÓW");
    expect(rows.find(row => row.name === "FootyNomad")?.status).toBe("MECZE ZNALEZIONE");
    const broken = getSourceDiagnostics(scan({ flashscore: { competitionsChecked: 4, rawMatches: 20, fixtures: 0, skippedNonEuropean: 10, skippedWrongDate: 5, timestampMissing: 2, errors: 1 } }));
    expect(broken.find(row => row.name === "Flashscore")?.status).toBe("ERROR");
  });

  it("keeps raw provider volume separate from accepted European fixtures", () => {
    const api = getSourceDiagnostics(scan()).find(row => row.name === "API-Football Pro");
    expect(api?.rawRecords).toBe(100);
    expect(api?.acceptedFixtures).toBe(6);
  });

  it("summarizes distinct countries and competitions from the merged fixture set", () => {
    const fixtures = [
      { countryCode: "BE", competition: "First Division" },
      { countryCode: "BE", competition: "Cup" },
      { countryCode: "NL", competition: "Eredivisie" },
    ] as FixtureScan["fixtures"];
    expect(summarizeFixtureCoverage(scan({}, fixtures))).toEqual({
      countries: 2, competitions: 3, countryCodes: ["BE", "NL"],
    });
  });
  it("does not fabricate raw counts for adapters that only expose filtered fixtures", () => {
    const rows = getSourceDiagnostics(scan());
    const openMatchday = rows.find(row => row.name === "OpenMatchday");
    expect(openMatchday?.rawRecords).toBeNull();
    expect(openMatchday?.preScopeFixtures).toBe(0);
    const pitchApi = rows.find(row => row.name === "PitchAPI");
    expect(pitchApi?.rawRecords).toBe(10);
    expect(pitchApi?.acceptedFixtures).toBe(2);
  });

});
