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
});
