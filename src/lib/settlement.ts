import { couponStatus, outcomeFromScore, settlePick } from "./domain";
import { deleteRow, insertRow, updateRow } from "./db";
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
 * Failed multi-row updates are compensated in reverse order to avoid leaving a
 * half-settled match when the browser client cannot open a DB transaction.
 */
export async function settleMatch(input: SettleInput, mode: SettleMode) {
  const now = new Date().toISOString();
  const { match } = input;
  const rollbackActions: Array<() => Promise<void>> = [];
  let resolve: (type: Prediction["prediction_type"], pick: Prediction["pick"]) => Settlement;

  try {
    if (mode.kind === "score") {
      const outcome = outcomeFromScore(mode.home, mode.away);
      const row = {
        match_id: match.id,
        home_goals: mode.home,
        away_goals: mode.away,
        outcome_1x2: outcome,
        source: mode.source ?? "ręcznie",
        settled_at: now,
      };
      if (input.existingResult) {
        const old = input.existingResult;
        await updateRow("match_results", old.id, row);
        rollbackActions.push(() => updateRow("match_results", old.id, {
          home_goals: old.home_goals,
          away_goals: old.away_goals,
          outcome_1x2: old.outcome_1x2,
          source: old.source,
          settled_at: old.settled_at,
        }));
      } else {
        const saved = await insertRow("match_results", row);
        rollbackActions.push(() => deleteRow("match_results", saved.id));
      }

      await updateRow("matches", match.id, { status: "finished" });
      rollbackActions.push(() => updateRow("matches", match.id, { status: match.status }));
      resolve = (type, pick) => settlePick(type, pick, outcome);
    } else {
      await updateRow("matches", match.id, { status: mode.status });
      rollbackActions.push(() => updateRow("matches", match.id, { status: match.status }));
      resolve = () => "void";
    }

    let changedPredictions = 0;
    for (const prediction of input.predictions.filter((x) => x.match_id === match.id)) {
      const settled = resolve(prediction.prediction_type, prediction.pick);
      if (prediction.result_status !== settled) {
        await updateRow("predictions", prediction.id, {
          result_status: settled,
          settled_at: now,
        });
        rollbackActions.push(() => updateRow("predictions", prediction.id, {
          result_status: prediction.result_status,
          settled_at: prediction.settled_at,
        }));
        changedPredictions++;
      }
    }

    const legs = input.legs.map((leg) => ({ ...leg }));
    const touchedCoupons = new Set<string>();
    for (const leg of legs.filter((x) => x.match_id === match.id)) {
      const settled = resolve(leg.prediction_type, leg.pick);
      touchedCoupons.add(leg.coupon_id);
      if (leg.result_status !== settled) {
        await updateRow("coupon_legs", leg.id, { result_status: settled });
        rollbackActions.push(() => updateRow("coupon_legs", leg.id, { result_status: leg.result_status }));
        leg.result_status = settled;
      }
    }

    let changedCoupons = 0;
    for (const couponId of touchedCoupons) {
      const coupon = input.coupons.find((x) => x.id === couponId);
      if (!coupon) continue;
      const status = couponStatus(legs.filter((leg) => leg.coupon_id === couponId).map((leg) => leg.result_status));
      if (coupon.status !== status) {
        await updateRow("coupons", couponId, {
          status,
          settled_at: status === "pending" ? null : now,
        });
        rollbackActions.push(() => updateRow("coupons", couponId, {
          status: coupon.status,
          settled_at: coupon.settled_at,
        }));
        changedCoupons++;
      }
    }

    return { changedPredictions, changedCoupons };
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const rollback of rollbackActions.reverse()) {
      try {
        await rollback();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
      }
    }
    const reason = error instanceof Error ? error.message : String(error);
    if (rollbackErrors.length) {
      throw new Error(`Rozliczenie nie powiodło się: ${reason}. Niepełne cofnięcie: ${rollbackErrors.join("; ")}`);
    }
    throw new Error(`Rozliczenie zostało cofnięte po błędzie: ${reason}`);
  }
}

/** Recomputes a coupon's status from its legs (e.g. after a manual leg change). */
export async function recomputeCoupon(coupon: Coupon, legs: CouponLeg[]) {
  const status = couponStatus(legs.filter((leg) => leg.coupon_id === coupon.id).map((leg) => leg.result_status));
  if (status !== coupon.status) {
    await updateRow("coupons", coupon.id, {
      status,
      settled_at: status === "pending" ? null : new Date().toISOString(),
    });
  }
  return status;
}
