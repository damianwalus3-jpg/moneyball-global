import { describe, expect, it } from "vitest";
import {
  bankrollBalance,
  buildCouponBatch,
  couponPayout,
  couponStatus,
  hitRate,
  groupHitRates,
  isCouponCandidate,
  settlePick,
  outcomeFromScore,
  validateBatch,
  validateCoupon,
} from "./domain";
import type { Match, Prediction } from "./types";

const pred = (id: string, match_id: string, probability: number, extra: Partial<Prediction> = {}) =>
  ({ id, match_id, probability, prediction_type: "1X2", pick: "1", selection_status: "WYBRANY", result_status: "pending", ...extra }) as Prediction;

describe("coupon candidates", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const match = { id: "m1", kickoff_at: "2026-11-11T20:00:00Z", status: "scheduled" } as Match;
  it("rejects exactly 75% (must be strictly above)", () => {
    expect(isCouponCandidate(pred("p", "m1", 75), match, now)).toBe(false);
    expect(isCouponCandidate(pred("p", "m1", 75.1), match, now)).toBe(true);
  });
  it("rejects ODRZUCONY predictions", () => {
    expect(isCouponCandidate(pred("p", "m1", 90, { selection_status: "ODRZUCONY" }), match, now)).toBe(false);
  });
  it("rejects matches that already started", () => {
    expect(isCouponCandidate(pred("p", "m1", 90), { ...match, kickoff_at: "2026-11-10T11:00:00Z" }, now)).toBe(false);
  });
});

describe("coupon builder", () => {
  it("builds coupons of exactly 3 distinct matches with no match reused in the batch", () => {
    const cands = [
      pred("a", "m1", 90), pred("a2", "m1", 85, { prediction_type: "DC", pick: "1X" }),
      pred("b", "m2", 88), pred("c", "m3", 86), pred("d", "m4", 84), pred("e", "m5", 82),
      pred("f", "m6", 80), pred("g", "m7", 79), pred("low", "m8", 70),
    ];
    const batch = buildCouponBatch(cands, 5);
    expect(batch).toHaveLength(2);
    batch.forEach((c) => expect(new Set(c.map((l) => l.match_id)).size).toBe(3));
    const all = batch.flat().map((l) => l.match_id);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("m8");
    expect(validateBatch(batch)).toEqual([]);
  });
  it("validation catches wrong size, duplicate match, low probability, reuse", () => {
    expect(validateCoupon([pred("a", "m1", 90), pred("b", "m2", 90)])).toContain("Kupon musi mieć dokładnie 3 zdarzenia.");
    expect(validateCoupon([pred("a", "m1", 90), pred("b", "m1", 90), pred("c", "m2", 90)])).toContain("Każde zdarzenie musi dotyczyć innego meczu.");
    expect(validateCoupon([pred("a", "m1", 75), pred("b", "m2", 90), pred("c", "m3", 90)]).length).toBe(1);
    expect(validateBatch([[pred("a", "m1", 90), pred("b", "m2", 90), pred("c", "m3", 90)], [pred("d", "m1", 90), pred("e", "m4", 90), pred("f", "m5", 90)]]).length).toBe(1);
  });
});

describe("settlement", () => {
  it("settles 1X2 and Double Chance separately", () => {
    expect(outcomeFromScore(2, 1)).toBe("1");
    expect(outcomeFromScore(1, 1)).toBe("X");
    expect(settlePick("1X2", "1", "X")).toBe("lost");
    expect(settlePick("DC", "1X", "X")).toBe("won");
    expect(settlePick("DC", "12", "X")).toBe("lost");
    expect(settlePick("DC", "X2", "2")).toBe("won");
  });
  it("coupon status: lost beats pending, all void is void", () => {
    expect(couponStatus(["won", "pending", "lost"])).toBe("lost");
    expect(couponStatus(["won", "pending", "won"])).toBe("pending");
    expect(couponStatus(["void", "void", "void"])).toBe("void");
    expect(couponStatus(["won", "void", "won"])).toBe("won");
  });
  it("payout treats void legs as odds 1.00", () => {
    expect(couponPayout(10, [{ odds: 2, result_status: "won" }, { odds: 3, result_status: "void" }, { odds: 1.5, result_status: "won" }])).toBe(30);
  });
});

describe("hit rates", () => {
  it("excludes void and pending from the rate", () => {
    expect(hitRate(["won", "won", "lost", "void", "pending"]).rate).toBe(66.7);
    expect(hitRate([]).rate).toBeNull();
  });
  it("groups by key", () => {
    const g = groupHitRates([{ l: "A", s: "won" as const }, { l: "A", s: "lost" as const }, { l: "B", s: "won" as const }], (x) => x.l, (x) => x.s);
    expect(g.find((x) => x.key === "A")?.rate).toBe(50);
    expect(g.find((x) => x.key === "B")?.rate).toBe(100);
  });
});

describe("bankroll", () => {
  it("shows no value when there are no transactions", () => {
    expect(bankrollBalance([])).toBeNull();
  });
  it("sums by transaction type", () => {
    expect(bankrollBalance([{ type: "deposit", amount: 100 }, { type: "stake", amount: 10 }, { type: "payout", amount: 25 }, { type: "withdrawal", amount: 15 }, { type: "adjustment", amount: -5 }])).toBe(95);
  });
});
