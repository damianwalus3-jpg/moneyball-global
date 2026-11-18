export type PredictionDecisionInput = {
  futureEligible: boolean;
  hasModel: boolean;
  evidenceCovered: boolean;
  baselineOnly: boolean;
  probability: number | null;
  modelCoverage: number;
  oddsReady: boolean;
};

export type PredictionDecision = {
  verdict: "WYBRANY" | "ODRZUCONY";
  decisionStatus: "FINAL" | "CONDITIONAL" | "REJECTED";
  couponEligibility: "READY" | "WAITING_FOR_ODDS" | "NOT_ELIGIBLE";
};

/** Keep model quality independent from bookmaker availability. */
export function evaluatePredictionDecision(input: PredictionDecisionInput): PredictionDecision {
  const qualityEligible = input.futureEligible
    && input.hasModel
    && input.evidenceCovered
    && !input.baselineOnly
    && input.probability != null
    && Number.isFinite(Number(input.probability))
    && Number(input.probability) > 75
    && Number.isFinite(input.modelCoverage)
    && input.modelCoverage >= 55;

  if (!qualityEligible) {
    return { verdict: "ODRZUCONY", decisionStatus: "REJECTED", couponEligibility: "NOT_ELIGIBLE" };
  }
  return input.oddsReady
    ? { verdict: "WYBRANY", decisionStatus: "FINAL", couponEligibility: "READY" }
    : { verdict: "WYBRANY", decisionStatus: "CONDITIONAL", couponEligibility: "WAITING_FOR_ODDS" };
}
