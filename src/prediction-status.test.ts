import { describe, expect, it } from "vitest";
import { getPredictionRecordStatus } from "./prediction-status";

describe("prediction record status", () => {
  it("qualifies a valid >=75% model pick when supporting evidence is incomplete and coupon-ineligible", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: true, couponEligible: false, evidenceComplete: false, thresholdMet: true })).toBe("KANDYDAT");
  });
  it("keeps a valid prediction preliminary when the model sample or kickoff is insufficient", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: false, evidenceComplete: false, thresholdMet: true })).toBe("WSTEPNA");
  });
  it("does not qualify below 75%", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: false, couponEligible: true, evidenceComplete: false, thresholdMet: false })).toBe("WSTEPNA");
  });
  it("qualifies when the model candidate and threshold pass even if evidence is incomplete", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: true, strongCandidate: true, couponEligible: true, evidenceComplete: false, thresholdMet: true })).toBe("KANDYDAT");
  });
  it("rejects a record with no valid probability vector", () => {
    expect(getPredictionRecordStatus({ probabilitiesAvailable: false, strongCandidate: false, couponEligible: false, evidenceComplete: false, thresholdMet: false })).toBe("ODRZUCONY");
  });
});
