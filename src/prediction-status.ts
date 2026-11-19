export type PredictionRecordStatus = "KANDYDAT" | "WSTEPNA" | "ODRZUCONY";

export interface PredictionStatusInput {
  probabilitiesAvailable: boolean;
  strongCandidate: boolean;
  couponEligible: boolean;
  evidenceComplete: boolean;
  thresholdMet: boolean;
}

/**
 * Model qualification is based on valid probabilities, the model's minimum
 * history sample, and the configured threshold. Missing supporting evidence
 * remains visible as a warning; it must not veto a >=75% model candidate.
 * Pricing/EV is a separate gate before a real-money bet is valued or placed.
 */
export function getPredictionRecordStatus(input: PredictionStatusInput): PredictionRecordStatus {
  if (input.strongCandidate && input.couponEligible && input.thresholdMet) return "KANDYDAT";
  if (input.probabilitiesAvailable && (!input.couponEligible || !input.thresholdMet)) return "WSTEPNA";
  return "ODRZUCONY";
}
