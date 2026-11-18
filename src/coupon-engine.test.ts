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
      fixtureId: id === "a-duplicate" ? "a" : id, fixtureDate: date, competition: "Test league", model: "test-v1",
      selection: "1", p1: probability, px: 0.1, p2: Math.max(0, 1 - probability - 0.1),
      strongCandidate: true, evidenceComplete: true, source: "test",
    },
  };
}

describe("three-leg coupon candidates", () => {
  it("creates only coupons with exactly three unique matches above 75%", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.80), prediction("b", 0.81), prediction("c", 0.90),
      prediction("d", 0.74), prediction("a-duplicate", 0.95),
    ], "2026-11-17");
    expect(candidates.length).toBe(1);
    expect(candidates[0].legs).toHaveLength(3);
    expect(new Set(candidates[0].legs.map(leg => leg.fixtureId)).size).toBe(3);
    expect(candidates[0].legs.every(leg => leg.probability >= 0.75)).toBe(true);
    expect(candidates[0].oddsAvailable).toBe(false);
  });

  it("qualifies Double Chance-only coupon legs at 75% without requiring the 1X2 gate", () => {
    const dc = (id: string, probability: number): TrackerRecord => ({
      ...prediction(id, 0.60),
      details: {
        ...prediction(id, 0.60).details,
        strongCandidate: false,
        strongDoubleChance: true,
        evidenceComplete: true,
        dc1x: probability,
        dcx2: probability - 0.01,
        dc12: probability - 0.02,
      },
    });
    const candidates = buildThreeLegCandidates([
      dc("dc-a", 0.75), dc("dc-b", 0.82), dc("dc-c", 0.79),
    ], "2026-11-17");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].legs.map(leg => leg.selection).sort()).toEqual(["1X", "1X", "1X"]);
    expect(candidates[0].legs.every(leg => leg.market === "DOUBLE_CHANCE" && leg.probability >= 0.75)).toBe(true);
  });

  it("does not mix different dates or duplicate fixtures", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.9), prediction("b", 0.9), prediction("c", 0.9, "2026-11-18"),
    ], "2026-11-17");
    expect(candidates).toHaveLength(0);
  });
  it("uses the newest eligible prediction per fixture even when Tracker rows are out of order", () => {
    const older = { ...prediction("a-old", 0.92), createdAt: "2026-11-17T08:00:00Z", details: { ...prediction("a-old", 0.92).details, fixtureId: "a" } };
    const newer = {
      ...prediction("a-new", 0.78),
      createdAt: "2026-11-17T12:00:00Z",
      details: { ...prediction("a-new", 0.78).details, fixtureId: "a" },
    };
    const rows = [
      older,
      prediction("b", 0.85),
      prediction("c", 0.86),
      newer,
    ];
    const candidates = buildThreeLegCandidates(rows, "2026-11-17");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].legs.find(leg => leg.fixtureId === "a")?.probability).toBe(0.78);
  });


  it("does not reuse an older strong candidate after a newer rejected prediction", () => {
    const old = prediction("a", 0.92);
    const rejected = {
      ...prediction("a", 0.92),
      id: "a-rejected",
      status: "ODRZUCONY",
      createdAt: "2026-11-17T13:00:00Z",
      details: { ...prediction("a", 0.92).details, strongCandidate: false },
    };
    const rows = [old, prediction("b", 0.85), prediction("c", 0.86), rejected];
    expect(buildThreeLegCandidates(rows, "2026-11-17")).toHaveLength(0);
  });

  it("uses the newest row even when the latest prediction is weak but still marked KANDYDAT", () => {
    const old = prediction("a", 0.92);
    const weak = {
      ...prediction("a", 0.70),
      id: "a-weak",
      createdAt: "2026-11-17T13:00:00Z",
      details: { ...prediction("a", 0.70).details, strongCandidate: false },
    };
    expect(buildThreeLegCandidates([old, prediction("b", 0.85), prediction("c", 0.86), weak], "2026-11-17")).toHaveLength(0);
  });

  it("rejects non-normalized probabilities and a selection that is not the model's top outcome", () => {
    const validB = prediction("b", 0.85);
    const validC = prediction("c", 0.86);
    const invalidSum = {
      ...prediction("a", 0.90),
      details: { ...prediction("a", 0.90).details, p1: 0.9, px: 0.2, p2: 0.2 },
    };
    const wrongSelection = {
      ...prediction("a", 0.90),
      details: { ...prediction("a", 0.90).details, selection: "X" },
    };
    expect(buildThreeLegCandidates([invalidSum, validB, validC], "2026-11-17")).toHaveLength(0);
    expect(buildThreeLegCandidates([wrongSelection, validB, validC], "2026-11-17")).toHaveLength(0);
  });

});
