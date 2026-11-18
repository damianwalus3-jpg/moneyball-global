import { describe, expect, it } from "vitest";
import { auditTrackerPredictions } from "./model-audit";
import type { TrackerRecord } from "./tracker-store";

const prediction: TrackerRecord = {
  id: "p1", kind: "prediction", title: "Home vs Away", status: "KANDYDAT", createdAt: "2026-11-17T08:00:00Z",
  details: { fixtureId: "f1", p1: 0.8, px: 0.1, p2: 0.1 },
};
const result: TrackerRecord = {
  id: "r1", kind: "result", title: "Home vs Away", status: "SETTLED", createdAt: "2026-11-17T20:00:00Z",
  details: { fixtureId: "f1", actual: "1" },
};

describe("tracker model audit", () => {
  it("joins predictions to results and calculates calibration buckets", () => {
    const audit = auditTrackerPredictions([prediction, result]);
    expect(audit.settledPredictions).toBe(1);
    expect(audit.metrics?.accuracy).toBe(1);
    expect(audit.metrics?.count).toBe(1);
    expect(audit.buckets[0].averageConfidence).toBeCloseTo(0.8);
    expect(audit.buckets[0].observedAccuracy).toBe(1);
  });
  it("audits Double Chance markets separately from 1X2", () => {
    const withDoubleChance: TrackerRecord = {
      ...prediction,
      details: { fixtureId: "f1", p1: 0.8, px: 0.1, p2: 0.1, dc1x: 0.9, dcx2: 0.2, dc12: 0.9 },
    };
    const audit = auditTrackerPredictions([withDoubleChance, result]);
    expect(audit.metrics?.count).toBe(1);
    expect(audit.doubleChance?.count).toBe(3);
    expect(audit.doubleChance?.accuracy).toBe(1);
    expect(audit.doubleChance?.brierScore).toBeCloseTo((0.1 ** 2 + 0.2 ** 2 + 0.1 ** 2) / 3);
  });
  it("audits explicit Double Chance records separately from 1X2", () => {
    const oneXTwo = { ...prediction, details: { fixtureId: "f1", model: "goals-poisson", market: "1X2", p1: 0.8, px: 0.1, p2: 0.1 } };
    const dc = { ...prediction, id: "dc1", details: { fixtureId: "f1", model: "goals-poisson", market: "DOUBLE_CHANCE", p1x: 0.9, px2: 0.2, p12: 0.9 } };
    const audit = auditTrackerPredictions([dc, oneXTwo, result]);
    expect(audit.metrics?.count).toBe(1);
    expect(audit.doubleChance?.count).toBe(3);
    expect(audit.modelComparisons.filter(item => item.model === "goals-poisson")).toHaveLength(2);
  });
  it("compares xG and goals models and flags samples below 30 matches", () => {
    const goals = { ...prediction, details: { fixtureId: "f1", model: "goals-poisson", market: "1X2", p1: 0.8, px: 0.1, p2: 0.1 } };
    const xg = { ...prediction, id: "pxg", details: { fixtureId: "f1", model: "xg-poisson", market: "1X2", p1: 0.4, px: 0.3, p2: 0.3 } };
    const audit = auditTrackerPredictions([goals, xg, result]);
    expect(audit.modelComparisons.filter(item => item.market === "1X2")).toHaveLength(2);
    expect(audit.modelComparisons.every(item => item.sampleQualified === false)).toBe(true);
    expect(audit.minimumSampleSize).toBe(30);
  });
  it("does not count predictions without a matching result", () => {
    const audit = auditTrackerPredictions([prediction]);
    expect(audit.metrics).toBeNull();
    expect(audit.unmatchedPredictions).toBe(1);
  });
  it("uses the newest result when duplicate settlement rows exist", () => {
    const newer: TrackerRecord = { ...result, id: "r-new", details: { fixtureId: "f1", actual: "2" } };
    const older = { ...result, id: "r-old", createdAt: "2026-11-16T20:00:00Z", details: { fixtureId: "f1", actual: "1" } };
    const audit = auditTrackerPredictions([prediction, newer, older]);
    expect(audit.metrics?.accuracy).toBe(0);
  });
  it("counts only the newest prediction per fixture in model metrics", () => {
    const older = { ...prediction, id: "p-old", details: { fixtureId: "f1", p1: 0.1, px: 0.1, p2: 0.8 } };
    const audit = auditTrackerPredictions([prediction, older, result]);
    expect(audit.settledPredictions).toBe(1);
    expect(audit.metrics?.count).toBe(1);
    expect(audit.metrics?.accuracy).toBe(1);
  });
  it("excludes malformed or non-normalized probability rows without crashing the audit", () => {
    const malformed: TrackerRecord = { ...prediction, id: "p-bad", details: { fixtureId: "f2", p1: 1.4, px: -0.2, p2: -0.2 } };
    const badResult: TrackerRecord = { ...result, id: "r-bad", details: { fixtureId: "f2", actual: "X" } };
    const audit = auditTrackerPredictions([malformed, badResult]);
    expect(audit.settledPredictions).toBe(0);
    expect(audit.unmatchedPredictions).toBe(1);
    expect(audit.metrics).toBeNull();
  });

  it("falls back to valid embedded Double Chance when the explicit DC row is malformed", () => {
    const oneXTwo = {
      ...prediction,
      details: { fixtureId: "f1", model: "goals-poisson", market: "1X2",
        p1: 0.8, px: 0.1, p2: 0.1, dc1x: 0.9, dcx2: 0.2, dc12: 0.9 },
    };
    const malformedDc = {
      ...prediction, id: "dc-bad",
      details: { fixtureId: "f1", model: "goals-poisson", market: "DOUBLE_CHANCE",
        p1x: 1.2, px2: 0.2, p12: 0.6 },
    };
    const audit = auditTrackerPredictions([malformedDc, oneXTwo, result]);
    const dc = audit.modelComparisons.find(item => item.model === "goals-poisson" && item.market === "DOUBLE_CHANCE");
    expect(dc?.count).toBe(3);
    expect(dc?.sampleMatches).toBe(1);
    expect(dc?.sampleQualified).toBe(false);
  });
});
