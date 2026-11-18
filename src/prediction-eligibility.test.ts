import { describe, expect, it } from "vitest";
import { isEvidenceQualifiedCandidate } from "./prediction-eligibility";
import type { TrackerRecord } from "./tracker-store";

function row(overrides: Partial<TrackerRecord> = {}): TrackerRecord {
  return {
    id: "prediction-1", kind: "prediction", title: "Home vs Away", status: "KANDYDAT",
    createdAt: "2026-11-18T10:00:00.000Z",
    details: { evidenceComplete: true, strongCandidate: true, strongDoubleChance: true },
    ...overrides,
  };
}

describe("evidence-qualified candidate gate", () => {
  it("requires complete evidence and the market-specific 75% flag", () => {
    expect(isEvidenceQualifiedCandidate(row(), "1X2")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row(), "DOUBLE_CHANCE")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: false, strongCandidate: true, strongDoubleChance: true } }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: true, strongCandidate: false, strongDoubleChance: true } }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: true, strongCandidate: true, strongDoubleChance: false } }), "DOUBLE_CHANCE")).toBe(false);
  });

  it("never treats rejected or non-prediction records as candidates", () => {
    expect(isEvidenceQualifiedCandidate(row({ status: "ODRZUCONY" }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(row({ kind: "match" }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(undefined, "1X2")).toBe(false);
  });
});
