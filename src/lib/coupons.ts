import { dedupeEuropeanMatches, hasFreshConfirmedOdds, isEligibleCouponPrediction, isEligibleEuropeanMatch, isKickoffToday, isFinishedStatus, stakeBalances, totalOdds, validateBatch } from "./domain";
import { cancelCouponForOwner, deleteRow, fetchAll, fetchMatchesByIds, insertRow, insertRows, updateRow } from "./db";
import type { CouponType, Prediction, SourceClass } from "./types";

export function getCouponSourceClass(couponType: CouponType): SourceClass {
  return couponType === "TEST" ? "PAPER" : "MODEL";
}

export function shouldRecordCouponStake(couponType: CouponType, recordStake?: boolean): boolean {
  return recordStake === true && getCouponSourceClass(couponType) !== "PAPER";
}

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
  const couponType = options.couponType ?? (targetLegs === 1 ? "MAIN" : "MEGA");
  if (couponType === "TEST") throw new Error("Nowe kupony TEST są wyłączone w produkcyjnym MAIN.");
  if (targetLegs === 1 && couponType !== "MAIN") throw new Error("Pojedynczy typ musi być zapisany jako kupon MAIN.");
  if (targetLegs === 3 && !["MEGA","EXTRA"].includes(couponType)) throw new Error("Kupon AKO musi mieć typ MEGA lub EXTRA.");
  const sourceClass = getCouponSourceClass(couponType);
  const recordStake = shouldRecordCouponStake(couponType, options.recordStake ?? true);
  if (!recordStake) throw new Error("Każdy nowy kupon MAIN/AKO musi zapisać dokładnie jedną stawkę w bankrollu.");
  if (options.stake !== 4) throw new Error("Stała stawka MONEYBALL wynosi dokładnie 4,00 € na kupon.");

  const flatPredictions = coupons.flat();
  if (flatPredictions.some((prediction) => !isEligibleCouponPrediction(prediction))) {
    throw new Error("Kupon może zawierać wyłącznie typy WYBRANY powyżej 75% z udokumentowanym źródłem, pokryciem modelu i wymaganą historią.");
  }
  const matchIds = flatPredictions.map((prediction) => prediction.match_id);
  if (new Set(matchIds).size !== matchIds.length) throw new Error("Ten sam mecz nie może wystąpić więcej niż raz w zapisywanym zestawie kuponów.");
  const nowMs = Date.now();
  const matches = await fetchMatchesByIds(matchIds);
  if (dedupeEuropeanMatches(matches).length !== matches.length) throw new Error("Ten sam mecz występuje więcej niż raz w zestawie kuponów (data Brussels + para drużyn).");
  const matchById = new Map(matches.map((match) => [match.id, match]));
  for (const prediction of flatPredictions) {
    const match = matchById.get(prediction.match_id);
    const kickoffMs = match?.kickoff_at ? Date.parse(match.kickoff_at) : Number.NaN;
    const status = String(match?.status ?? "").toLowerCase();
    if (!match || !isEligibleEuropeanMatch(match) || !isKickoffToday(match.kickoff_at, nowMs)
      || !Number.isFinite(kickoffMs) || kickoffMs <= nowMs || isFinishedStatus(match.status)
      || ["live","inplay","1h","2h","ht"].includes(status)) {
      throw new Error("Kupon może zawierać wyłącznie dzisiejsze, przyszłe mecze europejskich lig mężczyzn poziomu 1–2.");
    }
  }

  const errors = validateBatch(coupons, targetLegs, true);
  if (errors.length) throw new Error(errors.join(" "));
  if (coupons.some((coupon) => coupon.some((prediction) => !hasFreshConfirmedOdds(prediction, nowMs))))
    throw new Error("Kupon MAIN/MEGA/EXTRA wymaga rzeczywistego kursu wypłaty z potwierdzonego źródła, bukmachera, statusu prematch i czasu maksymalnie 6 godzin.");
  const stake = 4;
  const createdCoupons: string[] = [];
  const createdLegs: string[] = [];
  const createdTransactions: string[] = [];
  try {
    const balances = stakeBalances(await fetchAll("bankroll_transactions"), stake, coupons.length);
    for (const [index, predictions] of coupons.entries()) {
      const odds = totalOdds(predictions.map((prediction) => prediction.odds));
      const potentialReturn = odds != null ? Math.round(stake * odds * 100) / 100 : null;
      const coupon = await insertRow("coupons", {
        scan_run_id: options.scanRunId ?? null,
        name: `${options.namePrefix} #${index + 1}`.trim(),
        coupon_type: couponType,
        source_class: sourceClass,
        status: "pending",
        target_legs: targetLegs,
        combined_odds: odds,
        stake,
        potential_return: potentialReturn,
        notes: options.notes ?? null,
      });
      createdCoupons.push(coupon.id);
      const legs = await insertRows("coupon_legs", predictions.map((prediction, legIndex) => ({
        coupon_id: coupon.id,
        prediction_id: prediction.id,
        match_id: prediction.match_id,
        leg_number: (legIndex + 1) as 1 | 2 | 3,
        odds: prediction.odds,
        status: "pending",
      })));
      createdLegs.push(...legs.map((leg) => leg.id));
      if (legs.length !== predictions.length) throw new Error("Kupon " + coupon.name + ": zapisano " + legs.length + " z " + predictions.length + " zdarzeń.");
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

/** Cancel a coupon without erasing its audit trail;/** Cancel a coupon without erasing its audit trail; return its virtual stake once. */
export async function cancelCoupon(couponId: string) {
  return cancelCouponForOwner(couponId);
}
