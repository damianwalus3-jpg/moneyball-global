import type { TrackerRecord } from "./tracker-store";
import type { ThreeLegCandidate } from "./coupon-engine";
import { valueSelectionFromOdds, type OddsValuation } from "./odds-value";

export interface ValuedThreeLegCoupon {
  bookmaker: string;
  legs: [OddsValuation, OddsValuation, OddsValuation];
  combinedOdds: number;
  combinedProbability: number;
  expectedValue: number;
  stake: number;
  potentialReturn: number;
  potentialProfit: number;
}

/** Values a three-leg model coupon only when all legs have fresh prices from one bookmaker. */
export function valueThreeLegCoupon(
  candidate: ThreeLegCandidate,
  records: TrackerRecord[],
  bookmaker: string,
  now = new Date().toISOString(),
  maxAgeMinutes = 360,
  stake = 4,
): ValuedThreeLegCoupon | null {
  if (!bookmaker.trim() || !Number.isFinite(stake) || stake <= 0) return null;
  if (new Set(candidate.legs.map(leg => leg.fixtureId)).size !== 3) return null;
  const valuations = candidate.legs.map(leg => {
    // Current bookmaker snapshots contain only 1X2 prices. Never price DC legs as 1X2.
    if (leg.market !== "1X2" || (leg.selection !== "1" && leg.selection !== "X" && leg.selection !== "2")) return null;
    const fixturePredictions = records
      .filter(row => row.kind === "prediction" && row.details.fixtureId === leg.fixtureId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    // Never price a coupon against a stale/overridden prediction. The newest
    // prediction must still be the same qualified 75%+ 1X2 selection.
    const prediction = fixturePredictions[0];
    if (!prediction || prediction.status !== "KANDYDAT" || prediction.details.strongCandidate !== true
      || prediction.details.selection !== leg.selection) return null;
    const { p1, px, p2 } = prediction.details;
    if (typeof p1 !== "number" || typeof px !== "number" || typeof p2 !== "number") return null;
    const probabilities = [p1, px, p2];
    if (probabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1)
      || Math.abs(p1 + px + p2 - 1) > 0.0001) return null;
    const selectedProbability = leg.selection === "1" ? p1 : leg.selection === "X" ? px : p2;
    if (selectedProbability < 0.75 || Math.abs(selectedProbability - leg.probability) > 0.0001) return null;
    return valueSelectionFromOdds(records, leg.fixtureId, leg.selection, bookmaker, { p1, px, p2 }, now, maxAgeMinutes);
  });
  if (valuations.some(value => value === null)) return null;
  const legs = valuations as [OddsValuation, OddsValuation, OddsValuation];
  const combinedOdds = legs.reduce((product, leg) => product * leg.decimalOdds, 1);
  const combinedProbability = legs.reduce((product, leg) => product * leg.modelProbability, 1);
  if (Math.abs(combinedProbability - candidate.combinedProbability) > 0.0001) return null;
  const expectedValue = combinedProbability * combinedOdds - 1;
  const potentialReturn = stake * combinedOdds;
  return {
    bookmaker, legs, combinedOdds, combinedProbability, expectedValue,
    stake, potentialReturn, potentialProfit: potentialReturn - stake,
  };
}
