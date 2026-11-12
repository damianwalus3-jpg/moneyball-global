import { describe, expect, it } from "vitest";
import { generateMatchPredictions } from "./prediction-engine";
import type { Match, MatchResult } from "./types";

const target = {
  id: "next", kickoff_at: "2026-11-20T18:00:00.000Z", home_team: "Alpha", away_team: "Beta",
  status: "scheduled", league: "Test", country: "Test",
} as Match;

describe("goals-based prediction engine", () => {
  it("always creates separate 1X2 and Double Chance records", () => {
    const predictions = generateMatchPredictions(target, [target], [], "scan-1");
    expect(predictions.map((p) => p.prediction_type)).toEqual(["1X2", "DC"]);
    expect(predictions.every((p) => p.scan_run_id === "scan-1")).toBe(true);
    expect(predictions.every((p) => p.probability >= 0 && p.probability <= 100)).toBe(true);
  });

  it("rejects picks when the historical sample is insufficient", () => {
    const predictions = generateMatchPredictions(target, [target], [], null);
    expect(predictions.every((p) => p.selection_status === "ODRZUCONY")).toBe(true);
    expect(predictions.every((p) => p.rejection_reason?.includes("Za mało"))).toBe(true);
  });

  it("uses only matches completed before the target kickoff", () => {
    const prior: Match = { ...target, id: "old", kickoff_at: "2026-11-01T12:00:00Z", home_team: "Alpha", away_team: "Beta" };
    const future: Match = { ...target, id: "future", kickoff_at: "2026-11-25T12:00:00Z", home_team: "Alpha", away_team: "Beta" };
    const results: MatchResult[] = [
      ...[0, 1, 2].map((n) => ({ id: `r${n}`, match_id: "old", home_goals: 2, away_goals: 0 }) as MatchResult),
      { id: "rf", match_id: "future", home_goals: 0, away_goals: 5 } as MatchResult,
    ];
    const predictions = generateMatchPredictions(target, [target, prior, future], results, null);
    expect(predictions.every((p) => p.notes.includes("bez xG"))).toBe(true);
  });
});
