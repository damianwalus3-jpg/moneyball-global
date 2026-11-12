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
import type { BankrollTransaction, Match, Prediction } from "./types";

const prediction = (id: string, match_id: string, probability: number, extra: Partial<Prediction> = {}) =>
  ({
    id,
    owner_id: "owner",
    match_id,
    model_version: "MONEYBALL GLOBAL 3.8",
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
  it("calculates coupon status from exactly three legs", () => {
    expect(couponStatus(["won", "pending", "lost"])).toBe("lost");
    expect(couponStatus(["won", "pending", "won"])).toBe("pending");
    expect(couponStatus(["void", "void", "void"])).toBe("void");
    expect(couponStatus(["won", "void", "won"])).toBe("won");
    expect(couponStatus(["won", "won"])).toBe("pending");
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
