import { describe, expect, it } from "vitest";
import { mapOpenLigaTeamForm } from "./team-form";

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

  it("ignores unfinished matches and returns empty form when history is missing", () => {
    const form = mapOpenLigaTeamForm([{
      ...match("2026-08-01", "Club A", "Club B", 1, 0),
      matchIsFinished: false,
    }], "Club A", "2026-08-20");
    expect(form.matches).toHaveLength(0);
  });
});
