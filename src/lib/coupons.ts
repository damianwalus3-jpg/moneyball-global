import { totalOdds, validateBatch } from "./domain";
import { deleteRow, insertRow, insertRows } from "./db";
import type { CouponType, Prediction } from "./types";

export interface SaveBatchOptions {
  namePrefix: string;
  couponType?: CouponType;
  scanRunId?: string | null;
  stake: number | null;
  notes?: string | null;
  targetLegs?: 1 | 3;
}

/** Saves complete single-pick or 3-leg coupons. A failed batch rolls back only rows created by this call. */
export async function saveCouponBatch(coupons: Prediction[][], options: SaveBatchOptions) {
  if (!coupons.length) throw new Error("Brak kuponów do zapisania.");
  const targetLegs = options.targetLegs ?? 3;
  const requireOdds = options.couponType != null && options.couponType !== "TEST";
  const errors = validateBatch(coupons, targetLegs, requireOdds);
  if (errors.length) throw new Error(errors.join(" "));
  const createdCoupons: string[] = [];
  const createdLegs: string[] = [];
  try {
    for (const [index, predictions] of coupons.entries()) {
      const odds = totalOdds(predictions.map((prediction) => prediction.odds));
      const potentialReturn =
        options.stake != null && odds != null
          ? Math.round(options.stake * odds * 100) / 100
          : null;
      const coupon = await insertRow("coupons", {
        scan_run_id: options.scanRunId ?? null,
        name: `${options.namePrefix} #${index + 1}`.trim(),
        coupon_type: options.couponType ?? "TEST",
        status: "pending",
        target_legs: targetLegs,
        combined_odds: odds,
        stake: options.stake,
        potential_return: potentialReturn,
        notes: options.notes ?? null,
      });
      createdCoupons.push(coupon.id);

      const legs = await insertRows(
        "coupon_legs",
        predictions.map((prediction, legIndex) => ({
          coupon_id: coupon.id,
          prediction_id: prediction.id,
          leg_number: (legIndex + 1) as 1 | 2 | 3,
          odds: prediction.odds,
          status: "pending",
        })),
      );
      createdLegs.push(...legs.map((leg) => leg.id));
      if (legs.length !== predictions.length)
        throw new Error("Kupon " + coupon.name + ": zapisano " + legs.length + " z " + predictions.length + " zdarzeń.");
    }
  } catch (error) {
    for (const id of createdLegs.reverse()) {
      try { await deleteRow("coupon_legs", id); } catch { /* best-effort rollback of this new batch only */ }
    }
    for (const id of createdCoupons.reverse()) {
      try { await deleteRow("coupons", id); } catch { /* best-effort rollback of this new batch only */ }
    }
    throw error;
  }
  return createdCoupons.length;
}
