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
  const valuations = candidate.legs.map(leg => {
    const prediction = records
      .filter(row => row.kind === "prediction" && row.details.fixtureId === leg.fixtureId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!prediction) return null;
    const { p1, px, p2 } = prediction.details;
    if (typeof p1 !== "number" || typeof px !== "number" || typeof p2 !== "number") return null;
    return valueSelectionFromOdds(records, leg.fixtureId, leg.selection, bookmaker, { p1, px, p2 }, now, maxAgeMinutes);
  });
  if (valuations.some(value => value === null)) return null;
  const legs = valuations as [OddsValuation, OddsValuation, OddsValuation];
  const combinedOdds = legs.reduce((product, leg) => product * leg.decimalOdds, 1);
  const combinedProbability = candidate.combinedProbability;
  const expectedValue = combinedProbability * combinedOdds - 1;
  const potentialReturn = stake * combinedOdds;
  return {
    bookmaker, legs, combinedOdds, combinedProbability, expectedValue,
    stake, potentialReturn, potentialProfit: potentialReturn - stake,
  };
}
