import { bankrollBalance, signedAmount, totalOdds, validateBatch } from "./domain";
import { deleteRow, fetchAll, insertRow, insertRows } from "./db";
import type { CouponType, Prediction } from "./types";

export interface SaveBatchOptions {
  namePrefix: string;
  couponType?: CouponType;
  scanRunId?: string | null;
  stake: number | null;
  recordStake: boolean;
  notes?: string | null;
}

/** Saves only complete 3-leg coupons. A failed batch rolls back only rows created by this call. */
export async function saveCouponBatch(coupons: Prediction[][], options: SaveBatchOptions) {
  if (!coupons.length) throw new Error("Brak kompletnych kuponów do zapisania.");
  const errors = validateBatch(coupons);
  if (errors.length) throw new Error(errors.join(" "));
  if (options.recordStake && (options.stake == null || !Number.isFinite(options.stake) || options.stake <= 0))
    throw new Error("Podaj dodatnią stawkę albo wyłącz zapis stawki w bankrollu.");

  const createdCoupons: string[] = [];
  const createdLegs: string[] = [];
  const createdTransactions: string[] = [];
  const transactions = options.recordStake ? await fetchAll("bankroll_transactions") : [];
  let currentBalance = bankrollBalance(transactions);
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
        target_legs: 3,
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
      if (legs.length !== 3) throw new Error(`Kupon ${coupon.name}: nie zapisano wszystkich trzech nóg.`);
      createdLegs.push(...legs.map((leg) => leg.id));

      if (options.recordStake && options.stake != null && options.stake > 0) {
        const transactionType = "stake" as const;
        const delta = signedAmount({ transaction_type: transactionType, amount: options.stake });
        const nextBalance = currentBalance == null ? null : Math.round((currentBalance + delta) * 100) / 100;
        const transaction = await insertRow("bankroll_transactions", {
          transaction_type: transactionType,
          amount: options.stake,
          balance_after: nextBalance,
          coupon_id: coupon.id,
          occurred_at: new Date().toISOString(),
          note: `Stawka: ${coupon.name}`,
        });
        createdTransactions.push(transaction.id);
        currentBalance = nextBalance;
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
