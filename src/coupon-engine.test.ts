import { describe, expect, it } from "vitest";
import { buildThreeLegCandidates } from "./coupon-engine";
import type { TrackerRecord } from "./tracker-store";

function prediction(id: string, probability: number, date = "2026-11-17"): TrackerRecord {
  return {
    id,
    kind: "prediction",
    title: `${date} · Team ${id} vs Opponent`,
    status: "KANDYDAT",
    createdAt: "2026-11-17T08:00:00Z",
    details: {
      fixtureId: id, fixtureDate: date, competition: "Test league", model: "test-v1",
      selection: "1", p1: probability, px: 0.1, p2: 1 - probability - 0.1,
      strongCandidate: true, source: "test",
    },
  };
}

describe("three-leg coupon candidates", () => {
  it("creates only coupons with exactly three unique matches above 75%", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.80), prediction("b", 0.81), prediction("c", 0.90),
      prediction("d", 0.74), prediction("a-duplicate", 0.95),
    ]);
    expect(candidates.length).toBe(1);
    expect(candidates[0].legs).toHaveLength(3);
    expect(new Set(candidates[0].legs.map(leg => leg.fixtureId)).size).toBe(3);
    expect(candidates[0].legs.every(leg => leg.probability >= 0.75)).toBe(true);
    expect(candidates[0].oddsAvailable).toBe(false);
  });

  it("does not mix different dates or duplicate fixtures", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.9), prediction("b", 0.9), prediction("c", 0.9, "2026-11-18"),
    ]);
    expect(candidates).toHaveLength(0);
  });
});
