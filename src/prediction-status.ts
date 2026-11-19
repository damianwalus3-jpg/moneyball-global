export type PredictionRecordStatus = "KANDYDAT" | "WSTEPNA" | "ODRZUCONY";

export interface PredictionStatusInput {
  probabilitiesAvailable: boolean;
  strongCandidate: boolean;
  couponEligible: boolean;
  evidenceComplete: boolean;
  thresholdMet: boolean;
}

/**
 * Prediction qualification is a model decision: valid probabilities, sufficient
 * model history, a valid kickoff and the configured probability threshold.
 * Evidence completeness is an independent coupon gate and must never demote a
 * qualified model prediction. couponEligible/evidenceComplete remain in the
 * input for compatibility and for explicit downstream audit context.
 */
export function getPredictionRecordStatus(input: PredictionStatusInput): PredictionRecordStatus {
  if (input.probabilitiesAvailable && input.strongCandidate && input.thresholdMet) return "KANDYDAT";
  if (input.probabilitiesAvailable) return "WSTEPNA";
  return "ODRZUCONY";
}
