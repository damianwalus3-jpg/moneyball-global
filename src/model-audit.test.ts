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
});
