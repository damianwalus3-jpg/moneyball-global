import type { TrackerRecord } from "./tracker-store";
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
    && (date === undefined || row.details.date === date)
    && typeof row.details.fixtureId === "string").map(row => String(row.details.fixtureId)));
  const oneXTwo = new Set<string>(), doubleChance = new Set<string>();
  for (const row of records) {
    if (row.kind !== "prediction" || typeof row.details.fixtureId !== "string") continue;
    if (date !== undefined && row.details.fixtureDate !== date) continue;
    if (row.details.market === "DOUBLE_CHANCE") doubleChance.add(row.details.fixtureId);
    else oneXTwo.add(row.details.fixtureId); // legacy rows without a market field are 1X2
  }
  const expected = fixtures.size ? fixtures : new Set([...oneXTwo, ...doubleChance]);
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
