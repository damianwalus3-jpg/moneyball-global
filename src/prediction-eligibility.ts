import type { TrackerRecord } from "./tracker-store";

export type PredictionMarket = "1X2" | "DOUBLE_CHANCE";

/** A candidate is eligible only when the model threshold and all required evidence pass. */
export function isEvidenceQualifiedCandidate(
  row: TrackerRecord | undefined,
  market: PredictionMarket,
): boolean {
  if (!row || row.kind !== "prediction" || row.status !== "KANDYDAT"
    || row.details.evidenceComplete !== true) return false;
  return market === "1X2"
    ? row.details.strongCandidate === true
    : row.details.strongDoubleChance === true;
}
