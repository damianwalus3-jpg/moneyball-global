import { couponStatus, effectiveOdds, outcomeFromScore, settlePick, settleGoalsPick } from "./domain";
import { updateRow } from "./db";
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

async function refreshCouponTotals(coupon: Coupon, legs: CouponLeg[], status: Settlement, occurredAt: string) {
  const odds = effectiveOdds(legs);
  const combinedOdds = odds ?? coupon.combined_odds;
  const potentialReturn =
    coupon.stake != null && combinedOdds != null
      ? Math.round(coupon.stake * combinedOdds * 100) / 100
      : coupon.potential_return;
  const settledAt = status === "pending" ? null : occurredAt;
  if (
    coupon.status !== status ||
    coupon.combined_odds !== combinedOdds ||
    coupon.potential_return !== potentialReturn ||
    coupon.settled_at !== settledAt
  ) {
    await updateRow("coupons", coupon.id, {
      status,
      combined_odds: combinedOdds,
      potential_return: potentialReturn,
      settled_at: settledAt,
    });
    coupon.status = status;
    coupon.combined_odds = combinedOdds;
    coupon.potential_return = potentialReturn;
    coupon.settled_at = settledAt;
  }
}

/**
 * Saves a result first. Nothing is settled until the user explicitly verifies it.
 * Correcting or un-verifying a result recalculates predictions, coupon legs,
 * effective odds and any previously recorded coupon return.
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
    if (input.existingResult?.verified) {
      const affected = input.predictions.filter((prediction) => prediction.match_id === match.id && prediction.verdict === "WYBRANY");
      for (const prediction of affected) {
        if (prediction.settlement_status !== "pending" || prediction.verified) {
          await updateRow("predictions", prediction.id, { settlement_status: "pending", verified: false, profit_loss: null });
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
        if (!coupon || coupon.status === "cancelled") continue;
        const couponLegs = input.legs.filter((leg) => leg.coupon_id === couponId);
        const status = couponStatus(couponLegs.map((leg) => leg.status));
        if (coupon.status !== status) changedCoupons++;
        await refreshCouponTotals(coupon, couponLegs, status, now);
      }
      return { changedPredictions: affected.length, changedCoupons, verified: false };
    }
    return { changedPredictions: 0, changedCoupons: 0, verified: false };
  }

  const resolve = (prediction: Prediction): Settlement => {
    if (mode.kind === "void" || prediction.selection === "—") return "void";
    if (prediction.market === "GOALS") return settleGoalsPick(prediction.selection, mode.kind === "score" ? mode.home : 0, mode.kind === "score" ? mode.away : 0);
    return settlePick(prediction.market, prediction.selection, outcome!);
  };

  let changedPredictions = 0;
  for (const prediction of input.predictions.filter((item) => item.match_id === match.id && item.verdict === "WYBRANY")) {
    const status = resolve(prediction);
    if (prediction.settlement_status !== status || !prediction.verified) {
      await updateRow("predictions", prediction.id, {
        settlement_status: status,
        verified: true,
        stake: Number(prediction.stake ?? 5),
        potential_return: prediction.odds != null && Number(prediction.odds) > 1
          ? Math.round(Number(prediction.stake ?? 5) * Number(prediction.odds) * 100) / 100
          : null,
        profit_loss: status === "won" && prediction.odds != null && Number(prediction.odds) > 1
          ? Math.round(Number(prediction.stake ?? 5) * (Number(prediction.odds) - 1) * 100) / 100
          : status === "lost" ? -Number(prediction.stake ?? 5)
          : status === "void" ? 0
          : null,
      });
      prediction.settlement_status = status;
      prediction.verified = true;
      changedPredictions++;
    }
  }

  const predictionById = new Map(input.predictions.map((prediction) => [prediction.id, prediction]));
  const touchedLegs = input.legs.filter(
    (leg) => {
      const prediction = predictionById.get(leg.prediction_id);
      return prediction?.match_id === match.id && prediction.verdict === "WYBRANY";
    },
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
    if (!coupon || coupon.status === "cancelled") continue;
    const couponLegs = input.legs.filter((leg) => leg.coupon_id === couponId);
    const status = couponStatus(couponLegs.map((leg) => leg.status));
    if (coupon.status !== status) changedCoupons++;
    await refreshCouponTotals(coupon, couponLegs, status, now);
  }

  return { changedPredictions, changedCoupons, verified: true };
}
