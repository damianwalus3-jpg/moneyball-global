import { describe, expect, it } from "vitest";
import { fixtureKey, isEuropeanOpenLiga } from "./free-fixtures";

describe("European fixture source classification", () => {
  it("accepts known European country names and competition prefixes", () => {
    expect(isEuropeanOpenLiga({ leagueId: 1, leagueName: "Cup of Scotland 2026", leagueShortcut: "cup_scot" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 2, leagueName: "Regional league", leagueShortcut: "bl3" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 3, leagueName: "UEFA Conference League", leagueShortcut: "uecl" })).toBe(true);
  });

  it("rejects a non-football sport even when the league name looks European", () => {
    expect(isEuropeanOpenLiga({
      leagueId: 4,
      leagueName: "English Premier League",
      leagueShortcut: "epl",
      sport: { sportName: "Basketball" },
    })).toBe(false);
  });

  it("deduplicates source variants using normalized date and team names", () => {
    expect(fixtureKey("2026-11-17", "FC Zürich", "Bayern München"))
      .toBe(fixtureKey("2026-11-17", "fc zurich", "bayern munchen"));
    expect(fixtureKey("2026-11-17", "Home FC", "Away FC"))
      .not.toBe(fixtureKey("2026-11-18", "Home FC", "Away FC"));
  });
});
