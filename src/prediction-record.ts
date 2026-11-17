import type { TrackerRecord } from "./tracker-store";

function hasValidProbabilities(details: TrackerRecord["details"]): boolean {
  const values = [details.p1, details.px, details.p2];
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return false;
  return Math.abs((values[0] as number) + (values[1] as number) + (values[2] as number) - 1) <= 0.0001;
}

/**
 * Keeps failed form lookups from being duplicated on every scan, but allows a
 * later successful analysis to supersede an earlier placeholder prediction.
 */
export function shouldAppendPrediction(
  records: TrackerRecord[],
  fixtureId: string,
  model: string,
  nextProbabilitiesAvailable: boolean,
): boolean {
  const existing = records.filter(row => row.kind === "prediction"
    && row.details.fixtureId === fixtureId && row.details.model === model);
  if (existing.some(row => hasValidProbabilities(row.details))) return false;
  if (existing.length === 0) return true;
  return nextProbabilitiesAvailable;
}
