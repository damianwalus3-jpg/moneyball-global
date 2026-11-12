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
  | { kind: "score"; home: number; away: number; source?: string; verified?: boolean }
  | { kind: "void"; status: "cancelled" | "postponed"; source?: string; verified?: boolean };

/**
 * Saves a result first. Nothing is settled until the user explicitly verifies it.
 * A corrected verified result is applied again to all predictions and coupon legs.
 */
export async function settleMatch(input: SettleInput, mode: SettleMode) {
  const now = new Date().toISOString();
  const { match } = input;
  const verified = mode.verified === true;
  let outcome: ReturnType<typeof outcomeFromScore> | null = null;

  if (mode.kind === "score") {
    if (!Number.isInteger(mode.home) || !Number.isInteger(mode.away) || mode.home < 0 || mode.away < 0)
      throw new Error("Wynik musi zawierać nieujemne liczby całkowite.");
    outcome = outcomeFromScore(mode.home, mode.away);
    const row = {
      match_id: match.id,
      home_score: mode.home,
      away_score: mode.away,
      outcome_1x2: outcome,
      verified,
      source: mode.source ?? "ręcznie",
      finished_at: now,
      verified_at: verified ? now : null,
    };
    if (input.existingResult) await updateRow("match_results", input.existingResult.id, row);
    else await insertRow("match_results", row);
    await updateRow("matches", match.id, { status: "finished" });
  } else {
    const row = {
      match_id: match.id,
      home_score: null,
      away_score: null,
      outcome_1x2: null,
      verified,
      source: mode.source ?? "ręcznie",
      finished_at: now,
      verified_at: verified ? now : null,
    };
    if (input.existingResult) await updateRow("match_results", input.existingResult.id, row);
    else await insertRow("match_results", row);
    await updateRow("matches", match.id, { status: mode.status });
  }

  if (!verified) {
    // If a previously verified score is corrected and saved as unverified,
    // revert its downstream settlement until the new score is confirmed.
    if (input.existingResult?.verified) {
      const affected = input.predictions.filter((prediction) => prediction.match_id === match.id);
      for (const prediction of affected) {
        if (prediction.settlement_status !== "pending" || prediction.verified) {
          await updateRow("predictions", prediction.id, { settlement_status: "pending", verified: false });
          prediction.settlement_status = "pending";
          prediction.verified = false;
        }
      }
      const predictionIds = new Set(affected.map((prediction) => prediction.id));
      const touchedLegs = input.legs.filter((leg) => predictionIds.has(leg.prediction_id));
      const touchedCouponIds = new Set(touchedLegs.map((leg) => leg.coupon_id));
      for (const leg of touchedLegs) {
        if (leg.status !== "pending") {
          await updateRow("coupon_legs", leg.id, { status: "pending" });
          leg.status = "pending";
        }
      }
      let changedCoupons = 0;
      for (const couponId of touchedCouponIds) {
        const coupon = input.coupons.find((item) => item.id === couponId);
        if (!coupon) continue;
        const status = couponStatus(input.legs.filter((leg) => leg.coupon_id === couponId).map((leg) => leg.status));
        if (coupon.status !== status) {
          await updateRow("coupons", couponId, { status, settled_at: null });
          coupon.status = status;
          changedCoupons++;
        }
      }
      return { changedPredictions: affected.length, changedCoupons, verified: false };
    }
    return { changedPredictions: 0, changedCoupons: 0, verified: false };
  }

  const resolve = (prediction: Prediction): Settlement => {
    if (mode.kind === "void" || prediction.selection === "—") return "void";
    return settlePick(prediction.market, prediction.selection, outcome!);
  };

  let changedPredictions = 0;
  for (const prediction of input.predictions.filter((item) => item.match_id === match.id)) {
    const status = resolve(prediction);
    if (prediction.settlement_status !== status || !prediction.verified) {
      await updateRow("predictions", prediction.id, {
        settlement_status: status,
        verified: true,
      });
      prediction.settlement_status = status;
      prediction.verified = true;
      changedPredictions++;
    }
  }

  const predictionById = new Map(input.predictions.map((prediction) => [prediction.id, prediction]));
  const touchedLegs = input.legs.filter(
    (leg) => predictionById.get(leg.prediction_id)?.match_id === match.id,
  );
  const touchedCouponIds = new Set<string>();

  for (const leg of touchedLegs) {
    const prediction = predictionById.get(leg.prediction_id);
    if (!prediction) continue;
    const status = resolve(prediction);
    touchedCouponIds.add(leg.coupon_id);
    if (leg.status !== status) {
      await updateRow("coupon_legs", leg.id, { status });
      leg.status = status;
    }
  }

  let changedCoupons = 0;
  for (const couponId of touchedCouponIds) {
    const coupon = input.coupons.find((item) => item.id === couponId);
    if (!coupon) continue;
    const status = couponStatus(
      input.legs.filter((leg) => leg.coupon_id === couponId).map((leg) => leg.status),
    );
    if (coupon.status !== status) {
      await updateRow("coupons", couponId, {
        status,
        settled_at: status === "pending" ? null : now,
      });
      coupon.status = status;
      changedCoupons++;
    }
  }

  return { changedPredictions, changedCoupons, verified: true };
}

export async function recomputeCoupon(coupon: Coupon, legs: CouponLeg[]) {
  const status = couponStatus(legs.filter((leg) => leg.coupon_id === coupon.id).map((leg) => leg.status));
  if (status !== coupon.status) {
    await updateRow("coupons", coupon.id, {
      status,
      settled_at: status === "pending" ? null : new Date().toISOString(),
    });
  }
  return status;
}
