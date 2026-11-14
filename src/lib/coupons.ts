import { stakeBalances, totalOdds, validateBatch } from "./domain";
import { deleteRow, fetchAll, insertRow, insertRows } from "./db";
import type { CouponType, Prediction } from "./types";

export interface SaveBatchOptions {
  namePrefix: string;
  couponType?: CouponType;
  scanRunId?: string | null;
  stake: number | null;
  notes?: string | null;
  targetLegs?: 1 | 3;
  /** Adds one bankroll "stake" transaction per saved coupon. */
  recordStake?: boolean;
}

/** Saves complete single-pick or 3-leg coupons. A failed batch rolls back only rows created by this call. */
export async function saveCouponBatch(coupons: Prediction[][], options: SaveBatchOptions) {
  if (!coupons.length) throw new Error("Brak kuponów do zapisania.");
  const targetLegs = options.targetLegs ?? 3;
  const requireOdds = options.couponType != null && options.couponType !== "TEST";
  const errors = validateBatch(coupons, targetLegs, requireOdds);
  if (errors.length) throw new Error(errors.join(" "));
  if (options.stake == null || !Number.isFinite(options.stake) || options.stake <= 0)
    throw new Error("Stawka musi być większa od zera.");
  const stake = options.stake;
  const createdCoupons: string[] = [];
  const createdLegs: string[] = [];
  const createdTransactions: string[] = [];
  try {
    const balances = options.recordStake
      ? stakeBalances(await fetchAll("bankroll_transactions"), stake, coupons.length)
      : [];
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
      if (options.recordStake) {
        const transaction = await insertRow("bankroll_transactions", {
          transaction_type: "stake",
          amount: stake,
          balance_after: balances[index] ?? null,
          coupon_id: coupon.id,
          occurred_at: new Date().toISOString(),
          note: `Stawka kuponu ${coupon.name}`,
        });
        createdTransactions.push(transaction.id);
      }
    }
  } catch (error) {
    for (const id of createdTransactions.reverse()) {
      try { await deleteRow("bankroll_transactions", id); } catch { /* best-effort rollback of this new batch only */ }
    }
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
