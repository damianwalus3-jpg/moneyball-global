import { describe, expect, it } from "vitest";
import { predictFromRecentForm, predictFromPitchApiXgForm } from "./form-prediction";
import type { PitchApiXgForm } from "./pitchapi";
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

describe("PitchAPI xG Poisson model", () => {
  const xgForm = (team: string, xgFor: number, xgAgainst: number, isHome: boolean): PitchApiXgForm => ({
    team, sampleSize: 5, xgForPerMatch: xgFor, xgAgainstPerMatch: xgAgainst,
    shotsForPerMatch: 12, shotsAgainstPerMatch: 8,
    shotsOnTargetForPerMatch: 5, shotsOnTargetAgainstPerMatch: 3,
    bigChancesForPerMatch: 2, bigChancesAgainstPerMatch: 1,
    xgOnTargetForPerMatch: 1.2, xgOnTargetAgainstPerMatch: 0.6,
    ppdaPerMatch: 9, fieldTiltPerMatch: 55, boxEntriesPerMatch: 10, xThreatPerMatch: 0.8, xAssistedGoalsPerMatch: 0.6, directSpeedPerMatch: 1.8, source: "PitchAPI",
    matches: Array.from({ length: 5 }, (_, index) => ({
      matchId: "m_" + team + index, date: `2026-11-${String(17-index).padStart(2,"0")}`,
      isHome, xgFor, xgAgainst, goalsFor: 1, goalsAgainst: 0, shotsFor: 12, shotsAgainst: 8,
      shotsOnTargetFor: 5, shotsOnTargetAgainst: 3, bigChancesFor: 2, bigChancesAgainst: 1,
      xgOnTargetFor: 1.2, xgOnTargetAgainst: 0.6, xgNonPenaltyFor: xgFor, xgNonPenaltyAgainst: xgAgainst,
      ppdaFor: 9, fieldTiltFor: 55, boxEntriesFor: 10, xThreatFor: 0.8, xAssistedGoalsFor: 0.6, directSpeedFor: 1.8,
    })),
  });
  it("uses observed xG rather than goals-derived lambda and labels the model separately", () => {
    const prediction = predictFromPitchApiXgForm(xgForm("Home", 2.1, 0.7, true), xgForm("Away", 0.8, 1.6, false));
    expect(prediction.method).toBe("pitchapi-recent-xg-poisson");
    expect(prediction.prediction.expectedGoals.home).toBeCloseTo(1.85, 8);
    expect(prediction.prediction.expectedGoals.away).toBeCloseTo(0.75, 8);
    expect(prediction.strongCandidate).toBe(false);
    expect(prediction.note).toContain("out-of-sample");
  });
  it("requires at least three matches with real xG per side", () => {
    const short = xgForm("Home", 1, 1, true);
    short.matches = short.matches.slice(0, 2);
    expect(() => predictFromPitchApiXgForm(short, xgForm("Away", 1, 1, false))).toThrow(/co najmniej 3/);
  });
});

describe("neutral prior fallback", () => {
  it("always returns a normalized but explicitly non-qualified 1X2/DC prediction", async () => {
    const { predictFromNeutralPrior } = await import("./form-prediction");
    const result = predictFromNeutralPrior();
    const p = result.prediction.probabilities;
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
    expect(result.pick).toBe(["1", "X", "2"][([p.home, p.draw, p.away].indexOf(Math.max(p.home, p.draw, p.away)))]);
    expect(result.method).toBe("neutral-prior-poisson");
    expect(result.strongCandidate).toBe(false);
    expect(result.samples).toEqual({ homeAttack: 0, homeDefence: 0, awayAttack: 0, awayDefence: 0 });
    expect(result.note).toContain("PROGNOZA AWARYJNA");
  });
});
