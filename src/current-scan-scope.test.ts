import { describe, expect, it } from "vitest";
import { filterRecordsToCurrentScan } from "./current-scan-scope";
import type { TrackerRecord } from "./tracker-store";

function row(kind: TrackerRecord["kind"], id: string): TrackerRecord {
  return {
    id: kind + "-" + id,
    kind,
    title: id,
    status: "TEST",
    createdAt: "2026-11-19T07:00:00.000Z",
    details: { fixtureId: id, date: "2026-11-19" },
  };
}

describe("filterRecordsToCurrentScan", () => {
  it("excludes out-of-scope matches and predictions but preserves coupon, result and scan history", () => {
    const records = [
      row("match", "in-scope"),
      row("match", "out-of-scope"),
      row("prediction", "in-scope"),
      row("prediction", "out-of-scope"),
      row("coupon", "historical-coupon"),
      row("result", "historical-result"),
      row("scan", "historical-scan"),
    ];
    const filtered = filterRecordsToCurrentScan(records, new Set(["in-scope"]));
    expect(filtered.map(record => record.id)).toEqual([
      "match-in-scope", "prediction-in-scope", "coupon-historical-coupon",
      "result-historical-result", "scan-historical-scan",
    ]);
  });

  it("hides all match and prediction rows until a live scan allowlist exists", () => {
    const filtered = filterRecordsToCurrentScan([
      row("match", "old"), row("prediction", "old"), row("coupon", "keep"),
    ], new Set());
    expect(filtered.map(record => record.id)).toEqual(["coupon-keep"]);
  });
});
