import { hasFreshConfirmedOdds, isEligibleCouponPrediction, stakeBalances, totalOdds, validateBatch } from "./domain";
import { deleteRow, fetchAll, insertRow, insertRows, updateRow } from "./db";
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
  if (targetLegs !== 1 && targetLegs !== 3) throw new Error("MONEYBALL zapisuje wyłącznie single albo kupony 3-zdarzeniowe.");
  if (targetLegs === 1 && options.couponType !== "MAIN") throw new Error("Pojedynczy typ musi być zapisany jako kupon MAIN.");
  const requireOdds = options.couponType != null && options.couponType !== "TEST";
  // Enforce selection rules again at the persistence boundary. UI filtering is not a data-integrity boundary.
  if (coupons.some((coupon) => coupon.some((prediction) => !isEligibleCouponPrediction(prediction)))) {
    throw new Error("Kupon może zawierać wyłącznie aktywne typy WYBRANY z prawdopodobieństwem powyżej 75%. Typ ODRZUCONY lub już rozliczony nie może zostać zapisany.");
  }
  const errors = validateBatch(coupons, targetLegs, requireOdds);
  if (errors.length) throw new Error(errors.join(" "));
  if (requireOdds && coupons.some((coupon) => coupon.some((prediction) => !hasFreshConfirmedOdds(prediction, Date.now()))))
    throw new Error("Kupon MAIN/MEGA/EXTRA wymaga kursu z potwierdzonego źródła, bez zawieszenia, przedmeczowego i pobranego maksymalnie 6 godzin temu. Nieaktualny kurs nie może wejść do kuponu.");
  if (options.stake !== 4)
    throw new Error("Stała stawka MONEYBALL wynosi dokładnie 4,00 € na kupon.");
  const stake = 4;
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
        stake,
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

/** Cancel a coupon without erasing its audit trail; return its virtual stake once. */
export async function cancelCoupon(couponId: string) {
  const [coupons, legs, transactions] = await Promise.all([
    fetchAll("coupons"),
    fetchAll("coupon_legs"),
    fetchAll("bankroll_transactions"),
  ]);
  const coupon = coupons.find((item) => item.id === couponId);
  if (!coupon) throw new Error("Nie znaleziono kuponu.");
  if (coupon.status !== "pending") throw new Error("Można anulować wyłącznie kupon oczekujący.");
  const couponLegs = legs.filter((leg) => leg.coupon_id === couponId);
  for (const leg of couponLegs) {
    if (leg.status !== "void") await updateRow("coupon_legs", leg.id, { status: "void" });
  }
  await updateRow("coupons", couponId, { status: "cancelled", settled_at: new Date().toISOString() });

  const hasStake = transactions.some((tx) => tx.coupon_id === couponId && tx.transaction_type === "stake");
  const hasReturn = transactions.some((tx) => tx.coupon_id === couponId && tx.transaction_type === "return");
  if (hasStake && !hasReturn && coupon.stake != null && Number(coupon.stake) > 0) {
    await insertRow("bankroll_transactions", {
      transaction_type: "return",
      amount: Number(coupon.stake),
      balance_after: null,
      coupon_id: couponId,
      occurred_at: new Date().toISOString(),
      note: `Zwrot anulowanego kuponu: ${coupon.name}`,
    });
  }
  const updated = await fetchAll("bankroll_transactions");
  let balance = 0;
  for (const tx of [...updated].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    balance = Math.round((balance + (tx.transaction_type === "deposit" || tx.transaction_type === "return" ? Math.abs(Number(tx.amount)) : tx.transaction_type === "adjustment" ? Number(tx.amount) : -Math.abs(Number(tx.amount)))) * 100) / 100;
    if (tx.balance_after !== balance) await updateRow("bankroll_transactions", tx.id, { balance_after: balance });
  }
}
