import { describe, expect, it } from "vitest";
import {
  bankrollBalance,
  buildCouponBatch,
  buildSingleCouponBatch,
  couponPayout,
  couponStatus,
  hitRate,
  isValidPick,
  groupHitRates,
  isCouponCandidate,
  settlePick,
  settleGoalsPick,
  outcomeFromScore,
  validateBatch,
  validateCoupon,
} from "./domain";
import type { BankrollTransaction, Match, Prediction } from "./types";

const prediction = (id: string, match_id: string, probability: number, extra: Partial<Prediction> = {}) =>
  ({
    id,
    owner_id: "owner",
    match_id,
    model_version: "MONEYBALL GLOBAL 3.9",
    market: "1X2",
    selection: "1",
    probability,
    confidence: "high",
    verdict: "WYBRANY",
    rationale: null,
    created_at: "2026-11-10T10:00:00.000Z",
    group_name: "TEST",
    odds: 1.8,
    settlement_status: "pending",
    verified: false,
    note: null,
    ...extra,
  }) as Prediction;

const match = (id: string, kickoff_at = "2026-11-11T20:00:00.000Z") =>
  ({
    id,
    owner_id: "owner",
    scan_run_id: null,
    external_id: null,
    source: "test",
    competition: "Test league",
    country: "Belgium",
    gender: "men",
    home_team: "Home",
    away_team: "Away",
    kickoff_at,
    status: "scheduled",
    created_at: "2026-11-10T10:00:00.000Z",
    updated_at: "2026-11-10T10:00:00.000Z",
  }) as Match;

describe("pick validation", () => {
  it("safely rejects missing or unknown market values from legacy rows", () => {
    expect(isValidPick(undefined, "1")).toBe(false);
    expect(isValidPick(null, "1X")).toBe(false);
    expect(isValidPick("UNKNOWN" as never, "1")).toBe(false);
    expect(isValidPick("1X2", "1")).toBe(true);
  });
});

describe("coupon candidates", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("requires probability strictly above 75%", () => {
    expect(isCouponCandidate(prediction("p", "m1", 75), match("m1"), now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 75.1), match("m1"), now)).toBe(true);
  });
  it("rejects ODRZUCONY predictions", () => {
    expect(isCouponCandidate(prediction("p", "m1", 90, { verdict: "ODRZUCONY" }), match("m1"), now)).toBe(false);
  });
  it("rejects started and cancelled matches", () => {
    expect(isCouponCandidate(prediction("p", "m1", 90), match("m1", "2026-11-10T11:00:00Z"), now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), status: "cancelled" }, now)).toBe(false);
  });
});

describe("coupon builder", () => {
  it("builds exactly 3 distinct matches per coupon and never reuses a match in the batch", () => {
    const candidates = [
      prediction("a", "m1", 90),
      prediction("a2", "m1", 85, { market: "DOUBLE_CHANCE", selection: "1X" }),
      prediction("b", "m2", 88),
      prediction("c", "m3", 86),
      prediction("d", "m4", 84),
      prediction("e", "m5", 82),
      prediction("f", "m6", 80),
      prediction("g", "m7", 79),
      prediction("low", "m8", 75),
    ];
    const batch = buildCouponBatch(candidates, 5);
    expect(batch).toHaveLength(2);
    batch.forEach((coupon) => expect(new Set(coupon.map((leg) => leg.match_id)).size).toBe(3));
    const matchIds = batch.flat().map((leg) => leg.match_id);
    expect(new Set(matchIds).size).toBe(matchIds.length);
    expect(matchIds).not.toContain("m8");
    expect(validateBatch(batch)).toEqual([]);
    expect(validateBatch(batch, 3, true)).toEqual([]);
  });
  it("builds single-pick coupons without repeating a match and keeps the best pick", () => {
    const candidates = [
      prediction("a", "m1", 88),
      prediction("a2", "m1", 91, { market: "DOUBLE_CHANCE", selection: "1X" }),
      prediction("b", "m2", 86),
      prediction("c", "m3", 84),
      prediction("d", "m4", 80),
      prediction("low", "m5", 75),
    ];
    const batch = buildSingleCouponBatch(candidates, 3);
    expect(batch).toHaveLength(3);
    expect(batch.map((coupon) => coupon[0]?.id)).toEqual(["a2", "b", "c"]);
    expect(batch.every((coupon) => coupon.length === 1)).toBe(true);
    expect(validateBatch(batch, 1)).toEqual([]);
  });
  it("rejects missing or invalid odds for non-test coupon batches", () => {
    const noOdds = [prediction("a", "m1", 90, { odds: null }), prediction("b", "m2", 90), prediction("c", "m3", 90)];
    expect(validateBatch([noOdds], 3, true)).toContain("Kupon 1: Kupon MAIN/MEGA/EXTRA wymaga potwierdzonego kursu większego niż 1,00 dla każdego zdarzenia.");
    expect(validateBatch([noOdds], 3, false)).toEqual([]);
    expect(validateBatch([[prediction("a", "m1", 90, { odds: 1 }), prediction("b", "m2", 90), prediction("c", "m3", 90)]], 3, true).length).toBe(1);
  });
  it("rejects incomplete coupons, duplicate matches, low probability and batch reuse", () => {
    expect(validateCoupon([prediction("a", "m1", 90), prediction("b", "m2", 90)])).toContain("Kupon musi mieć dokładnie 3 zdarzenia.");
    expect(validateCoupon([prediction("a", "m1", 90), prediction("b", "m1", 90), prediction("c", "m2", 90)])).toContain("Każde zdarzenie musi dotyczyć innego meczu.");
    expect(validateCoupon([prediction("a", "m1", 75), prediction("b", "m2", 90), prediction("c", "m3", 90)]).length).toBe(1);
    expect(validateBatch([
      [prediction("a", "m1", 90), prediction("b", "m2", 90), prediction("c", "m3", 90)],
      [prediction("d", "m1", 90), prediction("e", "m4", 90), prediction("f", "m5", 90)],
    ])).toHaveLength(1);
  });
});

describe("settlement", () => {
  it("settles 1X2 and Double Chance independently", () => {
    expect(outcomeFromScore(2, 1)).toBe("1");
    expect(outcomeFromScore(1, 1)).toBe("X");
    expect(settlePick("1X2", "1", "X")).toBe("lost");
    expect(settlePick("DOUBLE_CHANCE", "1X", "X")).toBe("won");
    expect(settlePick("DOUBLE_CHANCE", "12", "X")).toBe("lost");
    expect(settlePick("DOUBLE_CHANCE", "X2", "2")).toBe("won");
  });
  it("calculates coupon status for single and three-leg coupons", () => {
    expect(couponStatus(["won"])).toBe("won");
    expect(couponStatus(["pending"])).toBe("pending");
    expect(couponStatus(["void"])).toBe("void");
    expect(couponStatus(["won", "pending", "lost"])).toBe("lost");
    expect(couponStatus(["won", "pending", "won"])).toBe("pending");
    expect(couponStatus(["void", "void", "void"])).toBe("void");
    expect(couponStatus(["won", "void", "won"])).toBe("won");
    expect(couponStatus(["won", "won"])).toBe("pending");
  });
  it("calculates single-pick odds and payout", () => {
    expect(couponStatus(["won"])).toBe("won");
    expect(couponPayout(10, [{ odds: 1.8, status: "won" }])).toBe(18);
  });
  it("treats void legs as odds 1.00 for payout", () => {
    expect(couponPayout(10, [
      { odds: 2, status: "won" },
      { odds: 3, status: "void" },
      { odds: 1.5, status: "won" },
    ])).toBe(30);
  });
});

describe("hit rates", () => {
  it("excludes void and pending from the rate", () => {
    expect(hitRate(["won", "won", "lost", "void", "pending"]).rate).toBe(66.7);
    expect(hitRate([]).rate).toBeNull();
  });
  it("groups by competition or market key", () => {
    const groups = groupHitRates(
      [{ key: "A", status: "won" as const }, { key: "A", status: "lost" as const }, { key: "B", status: "won" as const }],
      (item) => item.key,
      (item) => item.status,
    );
    expect(groups.find((group) => group.key === "A")?.rate).toBe(50);
    expect(groups.find((group) => group.key === "B")?.rate).toBe(100);
  });
});

describe("bankroll", () => {
  const tx = (transaction_type: BankrollTransaction["transaction_type"], amount: number, occurred_at: string, balance_after: number | null = null) =>
    ({ id: occurred_at, owner_id: "owner", transaction_type, amount, balance_after, coupon_id: null, occurred_at, note: null }) as BankrollTransaction;
  it("returns null when there are no transactions", () => {
    expect(bankrollBalance([])).toBeNull();
  });
  it("calculates the signed ledger from canonical transaction_type", () => {
    expect(bankrollBalance([
      tx("deposit", 100, "2026-01-01T10:00:00Z"),
      tx("stake", 10, "2026-01-02T10:00:00Z"),
      tx("return", 25, "2026-01-03T10:00:00Z"),
      tx("withdrawal", 15, "2026-01-04T10:00:00Z"),
      tx("adjustment", -5, "2026-01-05T10:00:00Z"),
    ])).toBe(95);
  });
  it("uses the latest recorded balance_after when available", () => {
    expect(bankrollBalance([
      tx("deposit", 100, "2026-01-01T10:00:00Z", 100),
      tx("stake", 10, "2026-01-02T10:00:00Z", 90),
    ])).toBe(90);
  });
});


describe("GOALS market settlement", () => {
  it("settles BTTS and over/under from the exact score", () => {
    expect(settleGoalsPick("BTTS_YES", 2, 1)).toBe("won");
    expect(settleGoalsPick("BTTS_YES", 2, 0)).toBe("lost");
    expect(settleGoalsPick("BTTS_NO", 0, 2)).toBe("won");
    expect(settleGoalsPick("OVER_1.5", 1, 1)).toBe("won");
    expect(settleGoalsPick("UNDER_1.5", 1, 0)).toBe("won");
    expect(settleGoalsPick("OVER_2.5", 2, 1)).toBe("won");
    expect(settleGoalsPick("UNDER_2.5", 1, 1)).toBe("won");
    expect(settleGoalsPick("OVER_3.5", 2, 2)).toBe("won");
    expect(settleGoalsPick("UNDER_3.5", 2, 1)).toBe("won");
  });
  it("rejects invalid score input", () => {
    expect(() => settleGoalsPick("OVER_2.5", -1, 2)).toThrow();
  });
  it("validates every supported goals selection", () => {
    for (const selection of ["BTTS_YES", "BTTS_NO", "OVER_1.5", "UNDER_1.5", "OVER_2.5", "UNDER_2.5", "OVER_3.5", "UNDER_3.5"])
      expect(isValidPick("GOALS", selection)).toBe(true);
  });
});
