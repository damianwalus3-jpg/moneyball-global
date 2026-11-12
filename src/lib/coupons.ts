import { combinedProbability, totalOdds, validateBatch } from "./domain";
import { insertRow, insertRows } from "./db";
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
  let created = 0;
  for (const [i, legs] of coupons.entries()) {
    const coupon = await insertRow("coupons", {
      name: `${opts.namePrefix} #${i + 1}`.trim(),
      batch_id: batchId,
      stake: opts.stake,
      total_odds: totalOdds(legs.map((l) => l.odds)),
      combined_probability: combinedProbability(legs.map((l) => l.probability)),
      status: "pending",
    });
    await insertRows(
      "coupon_legs",
      legs.map((l, index) => ({
        coupon_id: coupon.id,
        leg_number: index + 1,
        prediction_id: l.id,
        match_id: l.match_id,
        prediction_type: l.prediction_type,
        pick: l.pick,
        probability: l.probability,
        odds: l.odds,
        result_status: "pending",
      })),
    );
    if (opts.recordStake && opts.stake && opts.stake > 0) {
      await insertRow("bankroll_transactions", {
        occurred_at: new Date().toISOString(),
        type: "stake",
        amount: opts.stake,
        coupon_id: coupon.id,
        note: `Stawka: ${coupon.name ?? "kupon"}`,
      });
    }
    created++;
  }
  return created;
}
