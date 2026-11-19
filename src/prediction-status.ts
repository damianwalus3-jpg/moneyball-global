export type PredictionRecordStatus = "KANDYDAT" | "WSTEPNA" | "ODRZUCONY";

export interface PredictionStatusInput {
  probabilitiesAvailable: boolean;
  strongCandidate: boolean;
  couponEligible: boolean;
  evidenceComplete: boolean;
  thresholdMet: boolean;
}

/**
 * Missing lineup, odds, or other evidence must not erase a valid analytical
 * prediction. Keep it visible as preliminary; reserve rejection for a valid,
 * fully evidenced prediction that does not meet the model threshold.
 */
export function getPredictionRecordStatus(input: PredictionStatusInput): PredictionRecordStatus {
  if (input.strongCandidate && input.couponEligible && input.evidenceComplete && input.thresholdMet) return "KANDYDAT";
  if (input.probabilitiesAvailable && (!input.couponEligible || !input.evidenceComplete)) return "WSTEPNA";
  return "ODRZUCONY";
}
