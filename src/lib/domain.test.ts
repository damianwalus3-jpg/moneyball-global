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
  isEligibleCouponPrediction,
  hasFreshConfirmedOdds,
  modelHitRate,
  probabilityQuality,
  multiclass1X2Quality,
  probabilityQualityBySelection,
  isKickoffToday,
  isEuropeanTopTwoLeague,
  isEligibleEuropeanMatch,
  stakeBalances,
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
    competition: "Belgian Pro League",
    country: "Belgium",
    gender: "men",
    home_team: "Home",
    away_team: "Away",
    kickoff_at,
    status: "scheduled",
    created_at: "2026-11-10T10:00:00.000Z",
    updated_at: "2026-11-10T10:00:00.000Z",
  }) as Match;

describe("European domestic league scope", () => {
  it("keeps first and second tiers while excluding cups, youth and lower divisions", () => {
    expect(isEuropeanTopTwoLeague("England", "Premier League")).toBe(true);
    expect(isEuropeanTopTwoLeague("Greece", "Super League 2")).toBe(true);
    expect(isEuropeanTopTwoLeague("Ukraine", "Persha Liga")).toBe(true);
    expect(isEuropeanTopTwoLeague("North Macedonia", "2 MFL")).toBe(true);
    expect(isEuropeanTopTwoLeague("Slovakia", "2. liga")).toBe(true);
    expect(isEuropeanTopTwoLeague("ESP", "ESP_2_segunda-division")).toBe(true);
    expect(isEuropeanTopTwoLeague("Kosovo", "Liga E Pare")).toBe(true);
    expect(isEuropeanTopTwoLeague("Ukraine", "Druha Liga")).toBe(false);
    expect(isEuropeanTopTwoLeague("Italy", "Serie C - Girone B")).toBe(false);
    expect(isEuropeanTopTwoLeague("England", "Premier League Cup")).toBe(false);
    expect(isEuropeanTopTwoLeague("Germany", "Frauen Bundesliga")).toBe(false);
    expect(isEuropeanTopTwoLeague("Italy", "Serie A Femminile")).toBe(false);
    expect(isEuropeanTopTwoLeague("World", "UEFA Nations League")).toBe(false);
    expect(isEuropeanTopTwoLeague("World", "UEFA Nations League - League B")).toBe(false);
    expect(isEuropeanTopTwoLeague("World", "UEFA U21 Championship - Qualification")).toBe(false);
    const eligibleBase = { country: "Ukraine", competition: "Persha Liga", league: null, gender: "men" as const, home_team: "UCSA", away_team: "Polissya" };
    expect(isEligibleEuropeanMatch(eligibleBase)).toBe(true);
    expect(isEligibleEuropeanMatch({ ...eligibleBase, away_team: "Polissya II" })).toBe(false);
    expect(isEligibleEuropeanMatch({ ...eligibleBase, away_team: "Polissya B" })).toBe(false);
    expect(isEligibleEuropeanMatch({ ...eligibleBase, gender: "women" })).toBe(false);
    expect(isEligibleEuropeanMatch({ ...eligibleBase, competition: "Serie C" })).toBe(false);
    expect(isEuropeanTopTwoLeague("Austria", "Austrian 2. Liga")).toBe(true);
    expect(isEuropeanTopTwoLeague("Netherlands", "Eerste Divisie")).toBe(true);
    expect(isEuropeanTopTwoLeague("Turkey", "TFF First League")).toBe(true);
    expect(isEuropeanTopTwoLeague("Poland", "I Liga")).toBe(true);
    expect(isEuropeanTopTwoLeague("Romania", "Liga II")).toBe(true);
    expect(isEuropeanTopTwoLeague("Switzerland", "Challenge League")).toBe(true);
    expect(isEuropeanTopTwoLeague("Czechia", "FNL")).toBe(true);
    expect(isEuropeanTopTwoLeague("Denmark", "1. Division")).toBe(true);
    expect(isEuropeanTopTwoLeague("Estonia", "Esiliiga")).toBe(true);
    expect(isEuropeanTopTwoLeague("Finland", "Ykkosliiga")).toBe(true);
    expect(isEuropeanTopTwoLeague("Portugal", "Liga Portugal 2")).toBe(true);
    expect(isEuropeanTopTwoLeague("England", "League One")).toBe(false);
    expect(isEuropeanTopTwoLeague("England", "Premier League 2")).toBe(false);
    expect(isEuropeanTopTwoLeague("Germany", "3. Liga")).toBe(false);
    expect(isEuropeanTopTwoLeague("Italy", "Serie C")).toBe(false);
    expect(isEuropeanTopTwoLeague("Ukraine", "Druha Liga")).toBe(false);
  });
});

describe("pick validation", () => {
  it("safely rejects missing or unknown market values from legacy rows", () => {
    expect(isValidPick(undefined, "1")).toBe(false);
    expect(isValidPick(null, "1X")).toBe(false);
    expect(isValidPick("UNKNOWN" as never, "1")).toBe(false);
    expect(isValidPick("1X2", "1")).toBe(true);
  });
});

describe("probability quality", () => {
  it("calculates binary Brier score, log loss and calibration gap on verified settled events", () => {
    const rows = [
      { probability: 80, settlement_status: "won", verified: true },
      { probability: 60, settlement_status: "lost", verified: true },
      { probability: 99, settlement_status: "won", verified: false },
      { probability: 40, settlement_status: "void", verified: true },
    ] as const;
    const quality = probabilityQuality(rows as never);
    expect(quality.sample).toBe(2);
    expect(quality.brier).toBeCloseTo(0.2, 8);
    expect(quality.logLoss).toBeCloseTo((-Math.log(0.8) - Math.log(0.4)) / 2, 8);
    expect(quality.averageProbability).toBeCloseTo(0.7, 8);
    expect(quality.observedRate).toBeCloseTo(0.5, 8);
    expect(quality.calibrationGap).toBeCloseTo(0.2, 8);
  });

  it("returns null metrics when there are no verified settled forecasts", () => {
    expect(probabilityQuality([])).toEqual({
      sample: 0, brier: null, logLoss: null, averageProbability: null, observedRate: null, calibrationGap: null,
    });
  });

  it("rejects out-of-range probabilities", () => {
    const quality = probabilityQuality([
      { probability: 120, settlement_status: "won", verified: true },
    ] as never);
    expect(quality.sample).toBe(0);
  });
});

describe("multiclass 1X2 quality", () => {
  const rows = [
    { match_id: "m1", market: "1X2", selection: "1", probability: 60, settlement_status: "won", verified: true },
    { match_id: "m1", market: "1X2", selection: "X", probability: 25, settlement_status: "lost", verified: true },
    { match_id: "m1", market: "1X2", selection: "2", probability: 15, settlement_status: "lost", verified: true },
  ] as const;

  it("calculates the full three-class Brier and log loss from a complete verified match", () => {
    const quality = multiclass1X2Quality(rows as never);
    expect(quality.sample).toBe(1);
    expect(quality.brier).toBeCloseTo(0.245, 8);
    expect(quality.logLoss).toBeCloseTo(-Math.log(0.6), 8);
    expect(quality.averageProbability).toEqual({ "1": 0.6, X: 0.25, "2": 0.15 });
    expect(quality.observedRate).toEqual({ "1": 1, X: 0, "2": 0 });
  });

  it("excludes incomplete, unverified, contradictory and non-normalized matches", () => {
    const incomplete = rows.slice(0, 2);
    const unverified = rows.map((row, index) => index === 1 ? { ...row, verified: false } : row);
    const contradictory = rows.map((row, index) => index === 1 ? { ...row, settlement_status: "won" } : row);
    const notNormalized = rows.map((row, index) => index === 0 ? { ...row, probability: 70 } : row);
    for (const sample of [incomplete, unverified, contradictory, notNormalized]) {
      expect(multiclass1X2Quality(sample as never).sample).toBe(0);
      expect(multiclass1X2Quality(sample as never).brier).toBeNull();
    }
  });

  it("does not pool other markets into 1X2 scoring", () => {
    const dc = rows.map((row) => ({ ...row, market: "DOUBLE_CHANCE" }));
    expect(multiclass1X2Quality(dc as never).sample).toBe(0);
  });
});

describe("probability quality by selection", () => {
  it("keeps selections separate so different markets are not pooled into one misleading score", () => {
    const rows = [
      { selection: "1X", probability: 80, settlement_status: "won", verified: true },
      { selection: "1X", probability: 60, settlement_status: "lost", verified: true },
      { selection: "X2", probability: 70, settlement_status: "won", verified: true },
      { selection: "—", probability: 99, settlement_status: "won", verified: true },
    ] as const;
    const grouped = probabilityQualityBySelection(rows as never);
    expect(grouped).toHaveLength(2);
    expect(grouped.find((row) => row.selection === "1X")?.sample).toBe(2);
    expect(grouped.find((row) => row.selection === "X2")?.sample).toBe(1);
  });
});

describe("fresh bookmaker quote validation", () => {
  const now = Date.parse("2026-11-16T12:00:00.000Z");
  const fresh = {
    odds_source: "MoviOdds",
    odds_bookmaker: "bet365",
    odds_captured_at: "2026-11-16T11:30:00.000Z",
    odds_phase: "prematch",
    odds_suspended: false,
    odds_status: "CONFIRMED",
  };
  it("accepts a recent, sourced, unsuspended prematch quote", () => {
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90, { data_coverage: fresh }), now)).toBe(true);
  });
  it("rejects missing source/time, stale, suspended and in-play quotes", () => {
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90), now)).toBe(false);
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90, { data_coverage: { ...fresh, odds_captured_at: "2026-11-16T05:00:00.000Z" } }), now)).toBe(false);
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90, { data_coverage: { ...fresh, odds_status: "SUSPENDED", odds_suspended: true } }), now)).toBe(false);
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90, { data_coverage: { ...fresh, odds_phase: "inplay" } }), now)).toBe(false);
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 90, { data_coverage: { ...fresh, odds_captured_at: "2026-11-16T12:05:00.000Z" } }), now)).toBe(false);
  });
  it("allows a manual price only when its source timestamp is recent", () => {
    expect(hasFreshConfirmedOdds(prediction("p", "m1", 2.1, { data_coverage: { ...fresh, odds_source: "manual" } }), now)).toBe(true);
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
  it("rejects women competitions and non-men fixtures", () => {
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), competition: "Frauen Bundesliga" }, now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), gender: "women" }, now)).toBe(false);
  });
  it("rejects reserve and B teams even when the fixture feed labels them as men's", () => {
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), home_team: "UCSA", away_team: "Polissya II" }, now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), away_team: "Celta de Vigo II" }, now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), away_team: "Bayern Munich B" }, now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), away_team: "RC Celta Fortuna" }, now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), away_team: "Real Madrid Castilla" }, now)).toBe(false);
  });
  it("rejects started and cancelled matches", () => {
    expect(isCouponCandidate(prediction("p", "m1", 90), match("m1", "2026-11-10T11:00:00Z"), now)).toBe(false);
    expect(isCouponCandidate(prediction("p", "m1", 90), { ...match("m1"), status: "cancelled" }, now)).toBe(false);
  });
});

describe("coupon persistence eligibility", () => {
  it("accepts only pending WYBRANY predictions strictly above 75%", () => {
    expect(isEligibleCouponPrediction(prediction("a", "m1", 75.1))).toBe(true);
    expect(isEligibleCouponPrediction(prediction("b", "m2", 75))).toBe(false);
    expect(isEligibleCouponPrediction(prediction("c", "m3", 90, { verdict: "ODRZUCONY" }))).toBe(false);
    expect(isEligibleCouponPrediction(prediction("d", "m4", 90, { settlement_status: "won" }))).toBe(false);
    expect(isEligibleCouponPrediction(prediction("e", "m5", 90, { probability: null }))).toBe(false);
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

describe("overall model hit rate (Panel)", () => {
  const preds = [
    prediction("a", "m1", 60, { verdict: "ODRZUCONY", settlement_status: "won" }),
    prediction("b", "m2", 80, { verdict: "WYBRANY", settlement_status: "lost" }),
    prediction("c", "m3", 70, { verdict: "ODRZUCONY", settlement_status: "won" }),
    prediction("d", "m4", 70, { settlement_status: "pending" }),
    prediction("e", "m5", 70, { settlement_status: "void" }),
    prediction("f", "m6", 70, { selection: "1X", settlement_status: "won" }),
    prediction("g", "m7", 70, { market: "DOUBLE_CHANCE", selection: "X2", verdict: "ODRZUCONY", settlement_status: "won" }),
    prediction("h", "m8", 70, { market: "DOUBLE_CHANCE", selection: "1", settlement_status: "lost" }),
  ];
  it("counts ODRZUCONY picks too: 1X2 = 2 won / 3 settled", () => {
    const r = modelHitRate(preds, "1X2");
    expect([r.won, r.settled, r.rate]).toEqual([2, 3, 66.7]);
  });
  it("ignores pending, void and invalid picks; DC only 1X/X2/12", () => {
    const r = modelHitRate(preds, "DOUBLE_CHANCE");
    expect([r.won, r.settled, r.rate]).toEqual([1, 1, 100]);
  });
  it("does not relax coupon rules: ODRZUCONY is still not a candidate", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(isCouponCandidate(prediction("p", "m1", 90, { verdict: "ODRZUCONY" }), match("m1"), now)).toBe(false);
  });
});

describe("coupon generator rules", () => {
  const now = Date.parse("2026-11-14T16:00:00Z"); // 17:00 in Brussels
  it("only accepts matches kicking off today in Brussels", () => {
    expect(isKickoffToday("2026-11-14T20:00:00Z", now)).toBe(true);
    expect(isKickoffToday("2026-11-14T23:30:00Z", now)).toBe(false); // 00:30 on 15 Nov in Brussels
    expect(isKickoffToday("2026-11-15T12:00:00Z", now)).toBe(false);
    expect(isKickoffToday(null, now)).toBe(false);
  });
  it("records a fixed 4 EUR stake per coupon and continues the existing balance", () => {
    const ledger = [
      { id: "t1", owner_id: "o", transaction_type: "deposit", amount: 100, balance_after: 100, coupon_id: null, occurred_at: "2026-11-01T10:00:00Z", note: null },
    ] as BankrollTransaction[];
    expect(stakeBalances(ledger, 4, 2)).toEqual([96, 92]);
    expect(stakeBalances([], 4, 1)).toEqual([-4]);
  });
  it("builds coupons of 3 distinct matches with no reuse across coupons", () => {
    const batch = buildCouponBatch(
      ["m1", "m2", "m3", "m4", "m5", "m6", "m1"].map((m, i) => prediction("p" + i, m, 90 - i)),
      5,
    );
    expect(batch.length).toBe(2);
    const ids = batch.flat().map((p) => p.match_id);
    expect(new Set(ids).size).toBe(6);
  });
});
