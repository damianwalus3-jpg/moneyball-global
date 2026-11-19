import { describe, expect, it } from "vitest";
import { buildHistoryProvenance, buildPredictionModelMetadata, hasVerifiedXgHistory } from "./prediction-metadata";
import type { PitchApiXgForm } from "./pitchapi";
import type { TeamForm } from "./team-form";

function teamForm(team: string, venue: "H" | "A"): TeamForm {
  const matches = Array.from({ length: 4 }, (_, index) => ({
    date: `2026-11-${String(15 - index).padStart(2, "0")}`,
    opponent: `Opponent ${index}`, venue, goalsFor: 2, goalsAgainst: 1, result: "W" as const, points: 3,
  }));
  return { team, matches, home: venue === "H" ? matches : [], away: venue === "A" ? matches : [],
    source: "OpenLigaDB", sourceUpdatedAt: "2026-11-18T08:00:00Z" };
}
function xgForm(team: string, value: number): PitchApiXgForm {
  return {
    team, source: "PitchAPI", sampleSize: 3, xgForPerMatch: value, xgAgainstPerMatch: 0.8,
    shotsForPerMatch: 10, shotsAgainstPerMatch: 8, shotsOnTargetForPerMatch: 4, shotsOnTargetAgainstPerMatch: 3,
    bigChancesForPerMatch: 1.5, bigChancesAgainstPerMatch: 1, xgOnTargetForPerMatch: 1.1,
    xgOnTargetAgainstPerMatch: 0.6, ppdaPerMatch: 10, fieldTiltPerMatch: 52, boxEntriesPerMatch: 9,
    xThreatPerMatch: 0.5, xAssistedGoalsPerMatch: 0.4, directSpeedPerMatch: 1.2,
    matches: Array.from({ length: 3 }, (_, index) => ({
      matchId: team + index, date: `2026-11-${String(17 - index).padStart(2, "0")}`, isHome: true,
      xgFor: value, xgAgainst: 0.8, goalsFor: 2, goalsAgainst: 1, shotsFor: 10, shotsAgainst: 8,
      shotsOnTargetFor: 4, shotsOnTargetAgainst: 3, bigChancesFor: 1.5, bigChancesAgainst: 1,
      xgOnTargetFor: 1.1, xgOnTargetAgainst: 0.6, xgNonPenaltyFor: value, xgNonPenaltyAgainst: 0.8,
      ppdaFor: 10, fieldTiltFor: 52, boxEntriesFor: 9, xThreatFor: 0.5, xAssistedGoalsFor: 0.4, directSpeedFor: 1.2,
    })),
  };
}

describe("prediction model provenance metadata", () => {
  const home = teamForm("Home", "H"), away = teamForm("Away", "A");
  it("labels goals/results history separately and never calls it xG", () => {
    const metadata = buildPredictionModelMetadata("recent-form-goals-poisson", home, away, undefined, "2026-11-19");
    expect(metadata.modelSourceType).toBe("goals_results_history");
    expect(metadata.xgUsed).toBe(false);
    expect(metadata.xgSource).toBeNull();
    expect(metadata.modelCoverage).toContain("goals_for_against_results_only_not_xG");
    expect(buildHistoryProvenance(home, away, "2026-11-19")).toContain("Opponent 0");
    expect(buildHistoryProvenance(home, away, "2026-11-19")).toContain("nie xG");
  });
  it("sets xgUsed only when both teams have real, dated PitchAPI xG/xGA samples", () => {
    const forms = { home: xgForm("Home", 1.8), away: xgForm("Away", 1.2) };
    expect(hasVerifiedXgHistory(forms, "2026-11-19")).toBe(true);
    const metadata = buildPredictionModelMetadata("pitchapi-recent-xg-poisson", home, away, forms, "2026-11-19");
    expect(metadata.modelSourceType).toBe("xg_history");
    expect(metadata.xgUsed).toBe(true);
    expect(metadata.xgSource).toBe("PitchAPI");
  });
  it("does not mark xG as used when real xG fields or the minimum sample are missing", () => {
    const forms = { home: xgForm("Home", 1.8), away: xgForm("Away", 1.2) };
    forms.away.xgForPerMatch = null;
    expect(hasVerifiedXgHistory(forms, "2026-11-19")).toBe(false);
    const metadata = buildPredictionModelMetadata("pitchapi-recent-xg-poisson", home, away, forms, "2026-11-19");
    expect(metadata.modelSourceType).toBe("unavailable");
    expect(metadata.xgUsed).toBe(false);
    expect(metadata.xgSource).toBeNull();
  });
  it("marks neutral prior as baseline-only, never as an observed model", () => {
    const metadata = buildPredictionModelMetadata("neutral-prior-poisson", undefined, undefined, undefined, "2026-11-19");
    expect(metadata.modelSourceType).toBe("baseline_only");
    expect(metadata.xgUsed).toBe(false);
  });
});
