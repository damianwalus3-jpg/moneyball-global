import { describe, expect, it } from "vitest";
import { findOpenLigaFixtureResult, mapOpenLigaTeamForm } from "./team-form";
import { vi } from "vitest";

const match = (date: string, home: string, away: string, homeGoals: number, awayGoals: number) => ({
  matchDateTimeUTC: `${date}T18:00:00Z`,
  matchIsFinished: true,
  team1: { teamName: home },
  team2: { teamName: away },
  matchResults: [
    { resultTypeID: 1, resultName: "Halbzeitergebnis", resultOrderID: 1, pointsTeam1: 0, pointsTeam2: 0 },
    { resultTypeID: 2, resultName: "Endergebnis", resultOrderID: 2, pointsTeam1: homeGoals, pointsTeam2: awayGoals },
  ],
});

describe("OpenLigaDB team form", () => {
  it("uses the final score, ignores future/current fixtures and maps venue correctly", () => {
    const form = mapOpenLigaTeamForm([
      match("2026-08-01", "Club A", "Club B", 2, 0),
      match("2026-08-08", "Club C", "Club A", 1, 1),
      match("2026-08-15", "Club A", "Club D", 0, 1),
      match("2026-08-22", "Club A", "Club E", 4, 0),
    ], "Club A", "2026-08-20");
    expect(form.matches).toHaveLength(3);
    expect(form.matches[0].result).toBe("L");
    expect(form.home.every(row => row.venue === "H")).toBe(true);
    expect(form.away.every(row => row.venue === "A")).toBe(true);
    expect(form.matches.every(row => row.date < "2026-08-20")).toBe(true);
  });

  it("does not mistake a halftime-only score for a final result", () => {
    const form = mapOpenLigaTeamForm([{
      ...match("2026-08-01", "Club A", "Club B", 1, 0),
      matchResults: [{ resultTypeID: 1, resultName: "Halbzeitergebnis", resultOrderID: 1, pointsTeam1: 1, pointsTeam2: 0 }],
    }], "Club A", "2026-08-20");
    expect(form.matches).toHaveLength(0);
  });

  it("ignores unfinished matches and returns empty form when history is missing", () => {
    const form = mapOpenLigaTeamForm([{
      ...match("2026-08-01", "Club A", "Club B", 1, 0),
      matchIsFinished: false,
    }], "Club A", "2026-08-20");
    expect(form.matches).toHaveLength(0);
  });
});

describe("OpenLigaDB result settlement", () => {
  it("does not settle from a halftime-only result row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        matchDateTimeUTC: "2026-11-17T18:00:00Z",
        matchIsFinished: true,
        team1: { teamName: "Club A" },
        team2: { teamName: "Club B" },
        matchResults: [{ resultTypeID: 1, resultName: "Halbzeitergebnis", resultOrderID: 1, pointsTeam1: 2, pointsTeam2: 0 }],
      }],
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await findOpenLigaFixtureResult("bl1", "2026", "Club A", "Club B", "2026-11-17");
      expect(result).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns a result only for a finished matching fixture", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        matchDateTimeUTC: "2026-11-17T18:00:00Z",
        matchIsFinished: true,
        team1: { teamName: "Club A" },
        team2: { teamName: "Club B" },
        matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", resultOrderID: 2, pointsTeam1: 2, pointsTeam2: 1 }],
      }],
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await findOpenLigaFixtureResult("bl1", "2026", "Club A", "Club B", "2026-11-17");
      expect(result?.actual).toBe("1");
      expect(result?.homeGoals).toBe(2);
      expect(result?.awayGoals).toBe(1);
      expect(result?.source).toBe("OpenLigaDB");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
