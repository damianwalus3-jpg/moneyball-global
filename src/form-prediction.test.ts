import { describe, expect, it } from "vitest";
import { predictFromRecentForm } from "./form-prediction";
import type { TeamForm } from "./team-form";

function form(team: string, scored: number, conceded: number, venue: "H" | "A"): TeamForm {
  const matches = Array.from({ length: 5 }, (_, index) => ({
    date: `2026-09-${String(20 - index).padStart(2, "0")}`,
    opponent: `Opponent ${index}`,
    venue,
    goalsFor: scored,
    goalsAgainst: conceded,
    result: scored > conceded ? "W" as const : scored === conceded ? "D" as const : "L" as const,
    points: scored > conceded ? 3 : scored === conceded ? 1 : 0,
  }));
  return {
    team,
    matches,
    home: venue === "H" ? matches : [],
    away: venue === "A" ? matches : [],
    source: "test",
    sourceUpdatedAt: "2026-11-17T00:00:00Z",
  };
}

describe("recent-form Poisson baseline", () => {
  it("produces a normalized 1X2 distribution and separately derived Double Chance", () => {
    const prediction = predictFromRecentForm(form("Home", 2.2, 0.6, "H"), form("Away", 0.8, 1.8, "A"));
    const p = prediction.prediction.probabilities;
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
    expect(prediction.prediction.doubleChance.oneX).toBeCloseTo(p.home + p.draw, 10);
    expect(prediction.method).toBe("recent-form-goals-poisson");
    expect(prediction.pick).toBe("1");
    expect(prediction.strongCandidate).toBe(false);
  });

  it("refuses to predict with fewer than three historical matches", () => {
    const short = form("Home", 1, 1, "H");
    short.matches = short.matches.slice(0, 2);
    expect(() => predictFromRecentForm(short, form("Away", 1, 1, "A"))).toThrow(/co najmniej 3/);
  });
});
