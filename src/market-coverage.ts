import type { TrackerRecord } from "./tracker-store";
import { hasValidPredictionMarket, trackerFixtureIdentity } from "./prediction-record";
export interface MarketCoverage {
  fixtureCount: number;
  oneXTwoFixtureCount: number;
  doubleChanceFixtureCount: number;
  missingOneXTwo: string[];
  missingDoubleChance: string[];
  complete: boolean;
}
/** Compares today's fixture register against independent 1X2 and Double Chance prediction rows. */
export function auditMarketCoverage(records: TrackerRecord[], date?: string): MarketCoverage {
  const fixtures = new Set(records.filter(row => row.kind === "match"
    && (date === undefined || row.details.date === date))
    .map(row => trackerFixtureIdentity(row)).filter((id): id is string => Boolean(id)));
  const predictionFixtureIds = new Set<string>();
  for (const row of records) {
    if (row.kind !== "prediction") continue;
    if (date !== undefined && row.details.fixtureDate !== date) continue;
    const identity = trackerFixtureIdentity(row);
    if (identity) predictionFixtureIds.add(identity);
  }
  const expected = fixtures.size ? fixtures : predictionFixtureIds;
  // Record presence alone is not coverage: only the newest mathematically valid
  // probability vector for at least one model can satisfy a market.
  const oneXTwo = new Set([...expected].filter(id => hasValidPredictionMarket(records, id, "1X2")));
  const doubleChance = new Set([...expected].filter(id => hasValidPredictionMarket(records, id, "DOUBLE_CHANCE")));
  const missingOneXTwo = [...expected].filter(id => !oneXTwo.has(id)).sort();
  const missingDoubleChance = [...expected].filter(id => !doubleChance.has(id)).sort();
  return {
    fixtureCount: expected.size,
    oneXTwoFixtureCount: [...expected].filter(id => oneXTwo.has(id)).length,
    doubleChanceFixtureCount: [...expected].filter(id => doubleChance.has(id)).length,
    missingOneXTwo, missingDoubleChance,
    complete: missingOneXTwo.length === 0 && missingDoubleChance.length === 0,
  };
}
