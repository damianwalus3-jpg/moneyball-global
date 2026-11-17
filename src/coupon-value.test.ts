import { describe, expect, it } from "vitest";
import type { TrackerRecord } from "./tracker-store";
import type { ThreeLegCandidate } from "./coupon-engine";
import { valueThreeLegCoupon } from "./coupon-value";

const now = "2026-11-17T20:00:00.000Z";
const candidate: ThreeLegCandidate = {
  date: "2026-11-17", combinedProbability: 0.125, averageProbability: 0.5, oddsAvailable: false,
  legs: [
    { fixtureId: "f1", title: "A vs B", competition: "League", selection: "1", probability: 0.5, source: "model", model: "v1" },
    { fixtureId: "f2", title: "C vs D", competition: "League", selection: "X", probability: 0.5, source: "model", model: "v1" },
    { fixtureId: "f3", title: "E vs F", competition: "League", selection: "2", probability: 0.5, source: "model", model: "v1" },
  ],
};
function row(kind: "prediction" | "odds", fixtureId: string, details: Record<string, string | number | boolean | null>, status: string): TrackerRecord {
  return { id: kind + fixtureId, kind, title: fixtureId, status, createdAt: now, details: { fixtureId, ...details } };
}
function fullRecords(): TrackerRecord[] {
  const predictions = [
    row("prediction", "f1", { p1: 0.5, px: 0.25, p2: 0.25 }, "KANDYDAT"),
    row("prediction", "f2", { p1: 0.25, px: 0.5, p2: 0.25 }, "KANDYDAT"),
    row("prediction", "f3", { p1: 0.25, px: 0.25, p2: 0.5 }, "KANDYDAT"),
  ];
  const odds = ["f1", "f2", "f3"].map((id, index) => row("odds", id, {
    bookmaker: "Book A", market: "1X2", complete1X2: true,
    odds1: 2.2, oddsX: 2.2, odds2: 2.2, capturedAt: "2026-11-17T19:30:00.000Z",
  }, "COMPLETE_1X2"));
  return [...predictions, ...odds];
}

describe("three-leg coupon odds valuation", () => {
  it("calculates combined odds, expected value and €4 paper return", () => {
    const value = valueThreeLegCoupon(candidate, fullRecords(), "Book A", now);
    expect(value?.combinedOdds).toBeCloseTo(2.2 ** 3);
    expect(value?.expectedValue).toBeCloseTo(0.331);
    expect(value?.stake).toBe(4);
    expect(value?.potentialReturn).toBeCloseTo(4 * 2.2 ** 3);
    expect(value?.potentialProfit).toBeCloseTo(4 * (2.2 ** 3 - 1));
  });

  it("requires every leg to have fresh odds from the same bookmaker", () => {
    const records = fullRecords().filter(row => row.details.fixtureId !== "f3" || row.kind !== "odds");
    expect(valueThreeLegCoupon(candidate, records, "Book A", now)).toBeNull();
    expect(valueThreeLegCoupon(candidate, fullRecords(), "Other Book", now)).toBeNull();
  });

  it("rejects invalid stake and stale price data", () => {
    expect(valueThreeLegCoupon(candidate, fullRecords(), "Book A", now, 360, 0)).toBeNull();
    const stale = fullRecords().map(row => row.kind === "odds"
      ? { ...row, details: { ...row.details, capturedAt: "2026-11-17T10:00:00.000Z" } }
      : row);
    expect(valueThreeLegCoupon(candidate, stale, "Book A", now)).toBeNull();
  });
});
