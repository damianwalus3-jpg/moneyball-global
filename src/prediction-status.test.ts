import { describe, expect, it } from "vitest";
import { getPredictionRecordStatus } from "./prediction-status";

describe("prediction record status", () => {
  it("keeps a valid prediction preliminary when lineups or other evidence are missing", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: true, evidenceComplete: false, thresholdMet: true })).toBe("WSTEPNA");
  });
  it("keeps a valid prediction preliminary when team history is insufficient for coupon eligibility", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: false, evidenceComplete: false, thresholdMet: true })).toBe("WSTEPNA");
  });
  it("does not reject a valid neutral-prior prediction just because team history is unavailable", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: false, evidenceComplete: false, thresholdMet: false })).toBe("WSTEPNA");
  });
  it("qualifies only a strong, evidence-complete, coupon-eligible prediction", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: true, couponEligible: true, evidenceComplete: true, thresholdMet: true })).toBe("KANDYDAT");
  });
  it("rejects a fully evidenced prediction below the configured threshold", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: true, evidenceComplete: true, thresholdMet: false })).toBe("ODRZUCONY");
  });
  it("rejects a record with no valid probability vector", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: false, strongCandidate: false, couponEligible: false, evidenceComplete: false, thresholdMet: false })).toBe("ODRZUCONY");
  });
});
