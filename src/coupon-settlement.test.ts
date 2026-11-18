import { describe, expect, it } from "vitest";
import { buildPaperCouponSettlementRecord, evaluatePaperCoupon } from "./coupon-settlement";
import type { TrackerRecord } from "./tracker-store";

const coupon: TrackerRecord = {
  id: "c1", kind: "coupon", title: "Paper coupon", status: "PAPER_NO_ODDS", createdAt: "2026-11-17T08:00:00Z",
  details: { legsJson: JSON.stringify([
    { fixtureId: "a", selection: "1" },
    { fixtureId: "b", selection: "X" },
    { fixtureId: "c", selection: "2" },
  ]) },
};
const results: TrackerRecord[] = [
  { id: "r1", kind: "result", title: "a", status: "SETTLED", createdAt: "x", details: { fixtureId: "a", actual: "1" } },
  { id: "r2", kind: "result", title: "b", status: "SETTLED", createdAt: "x", details: { fixtureId: "b", actual: "X" } },
  { id: "r3", kind: "result", title: "c", status: "SETTLED", createdAt: "x", details: { fixtureId: "c", actual: "1" } },
];

describe("paper coupon settlement", () => {
  it("marks a three-leg coupon as hit or miss only when all results exist", () => {
    const settled = evaluatePaperCoupon(coupon, results);
    expect(settled?.status).toBe("PAPER_MISS");
    expect(settled?.correctLegs).toBe(2);
  });
  it("does not settle incomplete or malformed coupons", () => {
    expect(evaluatePaperCoupon(coupon, results.slice(0, 2))).toBeNull();
    const malformed = { ...coupon, details: { legsJson: "[]" } };
    expect(evaluatePaperCoupon(malformed, results)).toBeNull();
  });
  it("uses the newest valid result when a fixture has conflicting legacy rows", () => {
    const newest = { ...results[0], id: "new", details: { fixtureId: "a", actual: "2" as const } };
    const settled = evaluatePaperCoupon(coupon, [newest, ...results]);
    expect(settled?.status).toBe("PAPER_MISS");
    expect(settled?.correctLegs).toBe(1);
    expect(settled?.legResults.find(row => row.fixtureId === "a")?.actual).toBe("2");
  });
  it("calculates gross return and net profit for a priced winning coupon", () => {
    const priced = { ...coupon, status: "PAPER_WITH_ODDS", details: { ...coupon.details, bookmaker: "Book A", odds: 10, stake: 4 } };
    const evaluated = evaluatePaperCoupon(priced, results)!;
    const row = buildPaperCouponSettlementRecord(priced, { ...evaluated, status: "PAPER_HIT", correctLegs: 3 });
    expect(row.details.potentialReturn).toBe(40);
    expect(row.details.profitLoss).toBe(36);
    expect(row.details.stake).toBe(4);
  });
  it("records the full stake loss for a priced losing coupon", () => {
    const priced = { ...coupon, status: "PAPER_WITH_ODDS", details: { ...coupon.details, bookmaker: "Book A", odds: 10, stake: 4 } };
    const evaluated = evaluatePaperCoupon(priced, results)!;
    const row = buildPaperCouponSettlementRecord(priced, evaluated);
    expect(row.status).toBe("PAPER_MISS");
    expect(row.details.potentialReturn).toBe(0);
    expect(row.details.profitLoss).toBe(-4);
  });
  it("keeps all financial values null for legacy coupons without verified odds", () => {
    const evaluated = evaluatePaperCoupon(coupon, results)!;
    const row = buildPaperCouponSettlementRecord(coupon, evaluated);
    expect(row.details.odds).toBeNull();
    expect(row.details.stake).toBeNull();
    expect(row.details.profitLoss).toBeNull();
    expect(row.details.potentialReturn).toBeNull();
  });
  it("fails closed on malformed prices and stakes", () => {
    const priced = { ...coupon, status: "PAPER_WITH_ODDS", details: { ...coupon.details, odds: 1, stake: -4 } };
    const evaluated = evaluatePaperCoupon(priced, results)!;
    const row = buildPaperCouponSettlementRecord(priced, evaluated);
    expect(row.details.profitLoss).toBeNull();
    expect(row.details.potentialReturn).toBeNull();
  });
  it("settles Double Chance legs independently from 1X2 outcomes", () => {
    const mixed = { ...coupon, details: { legsJson: JSON.stringify([
      { fixtureId: "a", selection: "1X", market: "DOUBLE_CHANCE" },
      { fixtureId: "b", selection: "X2", market: "DOUBLE_CHANCE" },
      { fixtureId: "c", selection: "12", market: "DOUBLE_CHANCE" },
    ]) } };
    const settled = evaluatePaperCoupon(mixed, results)!;
    expect(settled.correctLegs).toBe(3);
    expect(settled.legResults.every(leg => leg.market === "DOUBLE_CHANCE" && leg.correct)).toBe(true);
  });
  it("rejects a three-leg coupon with repeated fixture IDs even across markets", () => {
    const duplicate = { ...coupon, details: { legsJson: JSON.stringify([
      { fixtureId: "a", selection: "1" }, { fixtureId: "a", selection: "1X" }, { fixtureId: "b", selection: "X" },
    ]) } };
    expect(evaluatePaperCoupon(duplicate, results)).toBeNull();
  });
  it("marks three correct legs as paper hit", () => {
    const allCorrect = results.map((row, index) => index === 2 ? { ...row, details: { fixtureId: "c", actual: "2" } } : row);
    expect(evaluatePaperCoupon(coupon, allCorrect)?.status).toBe("PAPER_HIT");
  });
});
