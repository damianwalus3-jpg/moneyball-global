import type { TrackerRecord } from "./tracker-store";

export type PredictionMarket = "1X2" | "DOUBLE_CHANCE";

/** Model candidate gate: ancillary evidence is displayed separately, not used to erase a valid >=75% candidate. */
export function isEvidenceQualifiedCandidate(
  row: TrackerRecord | undefined,
  market: PredictionMarket,
): boolean {
  if (!row || row.kind !== "prediction" || row.status !== "KANDYDAT"
    || row.details.modelSourceType === "baseline_only"
    || row.details.predictionMethod === "neutral-prior-poisson"
    || row.details.model === "moneyball:neutral-prior-poisson") return false;
  return market === "1X2"
    ? row.details.strongCandidate === true
    : row.details.strongDoubleChance === true;
}

/** Show model qualification separately from evidence completeness. */
export function getPredictionDisplayStatus(
  row: TrackerRecord | undefined,
  market: PredictionMarket,
  probability: number | null,
): string {
  if (!row || row.kind !== "prediction") return "BRAK PROGNOZY";
  if (isEvidenceQualifiedCandidate(row, market)) return "KANDYDAT MODELU ≥75%";
  if (row.details.evidenceComplete !== true && typeof probability === "number") {
    return "WSTĘPNA PROGNOZA · BRAK DANYCH UZUPEŁNIAJĄCYCH";
  }
  if (probability === null) return "BRAK POPRAWNEGO TYPU";
  if (probability >= 0.75) return "WYSOKIE PRAWDOPODOBIEŃSTWO · WYMAGA KWALIFIKACJI";
  return "PONIŻEJ PROGU 75%";
}
