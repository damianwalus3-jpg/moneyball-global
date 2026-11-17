import { describe, expect, it } from "vitest";
import { uniquePendingPredictions } from "./pending-settlement";
import type { TrackerRecord } from "./tracker-store";
const prediction = (id: string, fixtureId: string): TrackerRecord => ({ id, kind: "prediction", title: id, status: "KANDYDAT", createdAt: "2026-11-17T08:00:00Z", details: { fixtureId } });
const result = (fixtureId: string): TrackerRecord => ({ id: "r-" + fixtureId, kind: "result", title: "settled", status: "SETTLED", createdAt: "2026-11-17T20:00:00Z", details: { fixtureId, actual: "1" } });
describe("pending result settlement selection", () => {
  it("selects only one newest-first prediction for each unsettled fixture", () => { expect(uniquePendingPredictions([prediction("new", "f1"), prediction("old", "f1"), prediction("other", "f2")]).map(row => row.id)).toEqual(["new", "other"]); });
  it("skips fixtures that already have a result", () => { expect(uniquePendingPredictions([prediction("p1", "f1"), result("f1")])).toEqual([]); });
  it("ignores malformed rows without a fixture id", () => { const malformed = { ...prediction("bad", "f1"), details: {} }; expect(uniquePendingPredictions([malformed, prediction("good", "f2")]).map(row => row.id)).toEqual(["good"]); });
});
