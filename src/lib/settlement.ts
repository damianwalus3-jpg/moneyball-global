import { couponStatus, outcomeFromScore, settlePick } from "./domain";
import { insertRow, updateRow } from "./db";
import type { Coupon, CouponLeg, Match, MatchResult, Prediction, Settlement } from "./types";

export interface SettleInput {
  match: Match;
  existingResult?: MatchResult | undefined;
  predictions: Prediction[];
  legs: CouponLeg[];
  coupons: Coupon[];
}

export type SettleMode =
  | { kind: "score"; home: number; away: number; source?: string }
  | { kind: "void"; status: "cancelled" | "postponed" };

/**
 * Saves the match result and settles every prediction, coupon leg and coupon
 * touching this match. Re-running with a corrected score re-settles everything.
 */
export async function settleMatch(input: SettleInput, mode: SettleMode) {
  const now = new Date().toISOString();
  const { match } = input;
  let resolve: (type: Prediction["prediction_type"], pick: Prediction["pick"]) => Settlement;

  if (mode.kind === "score") {
    const outcome = outcomeFromScore(mode.home, mode.away);
    const row = {
      match_id: match.id,
      home_goals: mode.home,
      away_goals: mode.away,
      home_score: mode.home,
      away_score: mode.away,
      outcome_1x2: outcome,
      source: mode.source ?? "ręcznie",
      settled_at: now,
    };
    if (input.existingResult) await updateRow("match_results", input.existingResult.id, row);
    else await insertRow("match_results", row);
    await updateRow("matches", match.id, { status: "finished" });
    resolve = (type, pick) => settlePick(type, pick, outcome);
  } else {
    await updateRow("matches", match.id, { status: mode.status });
    resolve = () => "void";
  }

  let changedPredictions = 0;
  for (const p of input.predictions.filter((x) => x.match_id === match.id)) {
    const s = resolve(p.prediction_type, p.pick);
    if (p.result_status !== s) {
      await updateRow("predictions", p.id, { result_status: s, settlement_status: s, settled_at: now });
      changedPredictions++;
    }
  }

  const legs = input.legs.map((l) => ({ ...l }));
  const touchedCoupons = new Set<string>();
  for (const l of legs.filter((x) => x.match_id === match.id)) {
    const s = resolve(l.prediction_type, l.pick);
    touchedCoupons.add(l.coupon_id);
    if (l.result_status !== s) {
      await updateRow("coupon_legs", l.id, { result_status: s, status: s });
      l.result_status = s;
    }
  }

  let changedCoupons = 0;
  for (const cid of touchedCoupons) {
    const c = input.coupons.find((x) => x.id === cid);
    if (!c) continue;
    const st = couponStatus(legs.filter((l) => l.coupon_id === cid).map((l) => l.result_status));
    if (c.status !== st) {
      await updateRow("coupons", cid, { status: st, settled_at: st === "pending" ? null : now });
      changedCoupons++;
    }
  }
  return { changedPredictions, changedCoupons };
}

/** Recomputes a coupon's status from its legs (e.g. after a manual leg change). */
export async function recomputeCoupon(coupon: Coupon, legs: CouponLeg[]) {
  const st = couponStatus(legs.filter((l) => l.coupon_id === coupon.id).map((l) => l.result_status));
  if (st !== coupon.status)
    await updateRow("coupons", coupon.id, {
      status: st,
      settled_at: st === "pending" ? null : new Date().toISOString(),
    });
  return st;
}
