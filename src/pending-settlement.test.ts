import { describe, expect, it } from "vitest";
import { uniquePendingPredictions } from "./pending-settlement";
import type { TrackerRecord } from "./tracker-store";
const prediction = (id: string, fixtureId: string): TrackerRecord => ({ id, kind: "prediction", title: id, status: "KANDYDAT", createdAt: "2026-11-17T08:00:00Z", details: { fixtureId } });
const result = (fixtureId: string): TrackerRecord => ({ id: "r-" + fixtureId, kind: "result", title: "settled", status: "SETTLED", createdAt: "2026-11-17T20:00:00Z", details: { fixtureId, actual: "1" } });
describe("pending result settlement selection", () => {
  it("selects only one newest-first prediction for each unsettled fixture", () => { expect(uniquePendingPredictions([prediction("new", "f1"), prediction("old", "f1"), prediction("other", "f2")]).map(row => row.id)).toEqual(["new", "other"]); });
  it("skips fixtures that already have a result", () => { expect(uniquePendingPredictions([prediction("p1", "f1"), result("f1")])).toEqual([]); });
  it("retries a fixture when its newest result row has an invalid outcome", () => { const invalid: TrackerRecord = { id: "bad-result", kind: "result", title: "invalid", status: "SETTLED", createdAt: "2026-11-17T20:00:00Z", details: { fixtureId: "f1", actual: "?" } }; expect(uniquePendingPredictions([invalid, prediction("p1", "f1")]).map(row => row.id)).toEqual(["p1"]); });
  it("ignores malformed rows without a fixture id", () => { const malformed = { ...prediction("bad", "f1"), details: {} }; expect(uniquePendingPredictions([malformed, prediction("good", "f2")]).map(row => row.id)).toEqual(["good"]); });

  it("chooses the newest prediction by timestamp even when the Tracker array is out of order", () => {
    const older = { ...prediction("old", "f1"), createdAt: "2026-11-17T08:00:00Z" };
    const newer = { ...prediction("new", "f1"), createdAt: "2026-11-17T12:00:00Z" };
    expect(uniquePendingPredictions([older, prediction("other", "f2"), newer]).map(row => row.id)).toEqual(["new", "other"]);
  });
  it("does not retry predictions for a voided fixture", () => {
    const voidResult: TrackerRecord = { id: "void-f1", kind: "result", title: "Cancelled", status: "VOID", createdAt: "2026-11-17T20:00:00Z", details: { fixtureId: "f1", actual: "VOID" } };
    expect(uniquePendingPredictions([prediction("p1", "f1"), voidResult])).toEqual([]);
  });

});