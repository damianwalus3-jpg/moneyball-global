import type { TrackerRecord } from "./tracker-store";

export type PredictionMarket = "1X2" | "DOUBLE_CHANCE";

/** A candidate is eligible only when the model threshold and all required evidence pass. */
export function isEvidenceQualifiedCandidate(
  row: TrackerRecord | undefined,
  market: PredictionMarket,
): boolean {
  if (!row || row.kind !== "prediction" || row.status !== "KANDYDAT"
    || row.details.evidenceComplete !== true
    || row.details.modelSourceType === "baseline_only"
    || row.details.predictionMethod === "neutral-prior-poisson"
    || row.details.model === "moneyball:neutral-prior-poisson") return false;
  return market === "1X2"
    ? row.details.strongCandidate === true
    : row.details.strongDoubleChance === true;
}

/** UI wording separates a model's raw probability from evidence-qualified coupon eligibility. */
export function getPredictionDisplayStatus(
  row: TrackerRecord | undefined,
  market: PredictionMarket,
  probability: number | null,
): string {
  if (!row || row.kind !== "prediction") return "BRAK PROGNOZY";
  if (isEvidenceQualifiedCandidate(row, market)) return "KANDYDAT ≥75%";
  if (row.details.evidenceComplete !== true && typeof probability === "number") {
    return "WSTĘPNA PROGNOZA · NIEKWALIFIKOWANA";
  }
  if (probability === null) return "BRAK POPRAWNEGO TYPU";
  if (probability >= 0.75) return "WYSOKIE PRAWDOPODOBIEŃSTWO · NIEKWALIFIKOWANE";
  return "PONIŻEJ PROGU 75%";
}
