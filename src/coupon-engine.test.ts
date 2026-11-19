import { describe, expect, it } from "vitest";
import { buildThreeLegCandidates } from "./coupon-engine";
import { canonicalFixtureId } from "./free-fixtures";
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
      selection: "1", p1: probability, px: Math.min(0.1, (1 - probability) / 2), p2: 1 - probability - Math.min(0.1, (1 - probability) / 2),
      strongCandidate: true, couponEligible: true, evidenceComplete: true, source: "test",
    },
  };
}

describe("three-leg coupon candidates", () => {
  it("creates only coupons with exactly three unique matches above 75%", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.80), prediction("b", 0.81), prediction("c", 0.90),
      prediction("d", 0.74), {
        ...prediction("a-duplicate", 0.95),
        title: "2026-11-17 · Team a vs Opponent",
        details: { ...prediction("a-duplicate", 0.95).details, fixtureId: "a", home: "Team a", away: "Opponent" },
      },
    ], "2026-11-17");
    expect(candidates.length).toBe(1);
    expect(candidates[0].legs).toHaveLength(3);
    expect(new Set(candidates[0].legs.map(leg => leg.fixtureId)).size).toBe(3);
    expect(candidates[0].legs.every(leg => leg.probability >= 0.75)).toBe(true);
    expect(candidates[0].oddsAvailable).toBe(false);
  });

  it("qualifies Double Chance-only coupon legs at 75% without requiring the 1X2 gate", () => {
    const dc = (id: string, probability: number): TrackerRecord => ({
      ...prediction(id, 0.60), title: "DC " + id,
      details: { ...prediction(id, 0.60).details, model: "test-v1", market: "DOUBLE_CHANCE", selection: "1X", probability,
        p1x: probability, px2: 0.6, p12: 1.4 - probability,
        strongCandidate: false, strongDoubleChance: true, couponEligible: true, evidenceComplete: true },
    });
    const candidates = buildThreeLegCandidates([
      dc("dc-a", 0.75), dc("dc-b", 0.82), dc("dc-c", 0.79),
    ], "2026-11-17");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].legs.map(leg => leg.selection).sort()).toEqual(["1X", "1X", "1X"]);
    expect(candidates[0].legs.every(leg => leg.market === "DOUBLE_CHANCE" && leg.probability >= 0.75)).toBe(true);
  });

  it("does not allow the same fixture twice when it qualifies in both markets", () => {
    const oneXTwo = prediction("shared", 0.80);
    const dc = { ...prediction("shared", 0.90), id: "shared-dc", details: { ...prediction("shared", 0.90).details, market: "DOUBLE_CHANCE", selection: "1X", probability: 0.95, p1x: 0.95, px2: 0.55, p12: 0.5, strongCandidate: false, strongDoubleChance: true, couponEligible: true } };
    const candidates = buildThreeLegCandidates([oneXTwo, dc, prediction("b", 0.82), prediction("c", 0.85)], "2026-11-17");
    expect(candidates).toHaveLength(1);
    const sharedId = canonicalFixtureId("2026-11-17", "Team shared", "Opponent", "Test league");
    expect(candidates[0].legs.filter(leg => leg.fixtureId === sharedId)).toHaveLength(1);
    expect(candidates[0].legs.find(leg => leg.fixtureId === sharedId)?.market).toBe("DOUBLE_CHANCE");
  });
  it("excludes candidates after the verified kickoff time", () => {
    const started = { ...prediction("started", 0.90), details: { ...prediction("started", 0.90).details, fixtureTime: "00:00" } };
    expect(buildThreeLegCandidates([started, prediction("b", 0.85), prediction("c", 0.86)], "2026-11-18")).toHaveLength(0);
  });
  it("does not mix different dates or duplicate fixtures", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.9), prediction("b", 0.9), prediction("c", 0.9, "2026-11-18"),
    ], "2026-11-17");
    expect(candidates).toHaveLength(0);
  });
  it("uses the newest eligible prediction per fixture even when Tracker rows are out of order", () => {
    const olderBase = prediction("a-old", 0.92);
    const older = { ...olderBase, title: "2026-11-17 · Team a vs Opponent", createdAt: "2026-11-17T08:00:00Z",
      details: { ...olderBase.details, fixtureId: "a", home: "Team a", away: "Opponent" } };
    const newerBase = prediction("a-new", 0.78);
    const newer = { ...newerBase, title: "2026-11-17 · Team a vs Opponent", createdAt: "2026-11-17T12:00:00Z",
      details: { ...newerBase.details, fixtureId: "a", home: "Team a", away: "Opponent" } };
    const rows = [
      older,
      prediction("b", 0.85),
      prediction("c", 0.86),
      newer,
    ];
    const candidates = buildThreeLegCandidates(rows, "2026-11-17");
    expect(candidates).toHaveLength(1);
    const aId = canonicalFixtureId("2026-11-17", "Team a", "Opponent", "Test league");
    expect(candidates[0].legs.find(leg => leg.fixtureId === aId)?.probability).toBe(0.78);
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

  it("rejects Double Chance records whose three probabilities do not sum to two", () => {
    const invalidDc = { ...prediction("bad-dc", 0.9), details: { ...prediction("bad-dc", 0.9).details, market: "DOUBLE_CHANCE", selection: "1X", probability: 0.9, p1x: 0.9, px2: 0.9, p12: 0.9, strongCandidate: false, strongDoubleChance: true, couponEligible: true } };
    expect(buildThreeLegCandidates([invalidDc, prediction("b", 0.85), prediction("c", 0.86)], "2026-11-17")).toHaveLength(0);
  });
  it("deduplicates a match represented by two provider IDs", () => {
    const same = (id: string, probability: number): TrackerRecord => {
      const base = prediction(id, probability);
      return { ...base, title: "2026-11-17 · Club Brugge vs KAA Gent",
        details: { ...base.details, fixtureId: id, home: "Club Brugge", away: "KAA Gent" } };
    };
    const candidates = buildThreeLegCandidates([
      same("flashscore:1", 0.91), same("footynomad:2", 0.96),
      prediction("other-b", 0.88), prediction("other-c", 0.87), prediction("other-d", 0.86),
    ], "2026-11-17", 10);
    expect(candidates).toHaveLength(1);
    const legs = candidates.flatMap(candidate => candidate.legs);
    expect(legs.filter(leg => leg.title.includes("Club Brugge"))).toHaveLength(1);
    expect(new Set(legs.map(leg => leg.fixtureId)).size).toBe(3);
  });

  it("does not reuse a historical coupon fixture under another provider ID", () => {
    const coupon: TrackerRecord = {
      id: "old-coupon", kind: "coupon", title: "Historical coupon", status: "PAPER_NO_ODDS",
      createdAt: "2026-11-17T10:00:00.000Z",
      details: { date: "2026-11-17", legsJson: JSON.stringify([
        { fixtureId: "flashscore:old", title: "2026-11-17 · Club Brugge vs KAA Gent", competition: "League" },
      ]) },
    };
    const same = prediction("footynomad:new", 0.96);
    same.title = "2026-11-17 · Club Brugge vs KAA Gent";
    same.details = { ...same.details, home: "Club Brugge", away: "KAA Gent", competition: "League" };
    const candidates = buildThreeLegCandidates([
      coupon, same, prediction("other-b", 0.88), prediction("other-c", 0.87), prediction("other-d", 0.86),
    ], "2026-11-17", 10);
    expect(candidates.flatMap(candidate => candidate.legs).some(leg => leg.title.includes("Club Brugge"))).toBe(false);
  });
  it("blocks records marked coupon-eligible when required evidence is incomplete", () => {
    const legacy = { ...prediction("legacy", 0.95), details: { ...prediction("legacy", 0.95).details, couponEligible: true, evidenceComplete: false } };
    expect(buildThreeLegCandidates([legacy, prediction("b", 0.9), prediction("c", 0.9)], "2026-11-17")).toHaveLength(0);
  });
  it("never admits baseline-only records even if candidate flags are accidentally true", () => {
    const baseline = { ...prediction("baseline", 0.99), details: { ...prediction("baseline", 0.99).details,
      model: "moneyball:neutral-prior-poisson", modelSourceType: "baseline_only",
      predictionMethod: "neutral-prior-poisson", couponEligible: true, evidenceComplete: true } };
    expect(buildThreeLegCandidates([baseline, prediction("b", 0.9), prediction("c", 0.9)], "2026-11-17")).toHaveLength(0);
  });

  it("returns globally disjoint three-leg coupons rather than overlapping combinations", () => {
    const candidates = buildThreeLegCandidates([
      prediction("a", 0.95), prediction("b", 0.94), prediction("c", 0.93),
      prediction("d", 0.92), prediction("e", 0.91), prediction("f", 0.90),
    ], "2026-11-17", 10);
    expect(candidates).toHaveLength(2);
    const allIds = candidates.flatMap(coupon => coupon.legs.map(leg => leg.fixtureId));
    expect(allIds).toHaveLength(6);
    expect(new Set(allIds).size).toBe(6);
  });

  it("does not reuse a fixture already present in a historical coupon", () => {
    const historical: TrackerRecord = {
      id: "old-coupon", kind: "coupon", title: "Historical coupon", status: "PAPER_NO_ODDS",
      createdAt: "2026-11-16T08:00:00Z",
      details: { legsJson: JSON.stringify([{ fixtureId: "a", selection: "1" }, { fixtureId: "old-b", selection: "X" }, { fixtureId: "old-c", selection: "2" }]) },
    };
    const candidates = buildThreeLegCandidates([
      historical, prediction("a", 0.99), prediction("b", 0.90), prediction("c", 0.89), prediction("d", 0.88),
    ], "2026-11-17", 10);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].legs.some(leg => leg.fixtureId === "a")).toBe(false);
  });

});