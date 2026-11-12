import { combinedProbability, totalOdds, validateBatch } from "./domain";
import { deleteRow, insertRow, insertRows } from "./db";
import type { Prediction } from "./types";

export interface SaveBatchOptions {
  namePrefix: string;
  stake: number | null;
  recordStake: boolean;
}

/** Validates and stores a batch of 3-leg coupons with their legs. */
export async function saveCouponBatch(coupons: Prediction[][], opts: SaveBatchOptions) {
  const errors = validateBatch(coupons);
  if (errors.length) throw new Error(errors.join(" "));

  const batchId = crypto.randomUUID();
  const createdCouponIds: string[] = [];
  const createdLegIds: string[] = [];
  const createdTransactionIds: string[] = [];

  try {
    for (const [i, legs] of coupons.entries()) {
      const coupon = await insertRow("coupons", {
        name: `${opts.namePrefix} #${i + 1}`.trim(),
        batch_id: batchId,
        stake: opts.stake,
        total_odds: totalOdds(legs.map((l) => l.odds)),
        combined_probability: combinedProbability(legs.map((l) => l.probability)),
        status: "pending",
      });
      createdCouponIds.push(coupon.id);

      const savedLegs = await insertRows(
        "coupon_legs",
        legs.map((l) => ({
          coupon_id: coupon.id,
          prediction_id: l.id,
          match_id: l.match_id,
          prediction_type: l.prediction_type,
          pick: l.pick,
          probability: l.probability,
          odds: l.odds,
          result_status: "pending",
        })),
      );
      createdLegIds.push(...savedLegs.map((l) => l.id));

      if (opts.recordStake && opts.stake && opts.stake > 0) {
        const transaction = await insertRow("bankroll_transactions", {
          occurred_at: new Date().toISOString(),
          type: "stake",
          amount: opts.stake,
          coupon_id: coupon.id,
          note: `Stawka: ${coupon.name ?? "kupon"}`,
        });
        createdTransactionIds.push(transaction.id);
      }
    }
    return createdCouponIds.length;
  } catch (error) {
    const rollbackErrors: string[] = [];
    const rollback = async (table: "bankroll_transactions" | "coupon_legs" | "coupons", ids: string[]) => {
      for (const id of [...ids].reverse()) {
        try {
          await deleteRow(table, id);
        } catch (rollbackError) {
          rollbackErrors.push(`${table}/${id}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
    };
    await rollback("bankroll_transactions", createdTransactionIds);
    await rollback("coupon_legs", createdLegIds);
    await rollback("coupons", createdCouponIds);
    const reason = error instanceof Error ? error.message : String(error);
    if (rollbackErrors.length) {
      throw new Error(`Zapis kuponów nie powiódł się: ${reason}. Niepełne cofnięcie: ${rollbackErrors.join("; ")}`);
    }
    throw new Error(`Zapis kuponów został cofnięty po błędzie: ${reason}`);
  }
}
