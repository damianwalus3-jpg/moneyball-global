import { describe, expect, it } from "vitest";
import { getPredictionDisplayStatus, isEvidenceQualifiedCandidate } from "./prediction-eligibility";
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
  it("qualifies a market-specific >=75% model candidate even when supporting evidence is incomplete", () => {
    expect(isEvidenceQualifiedCandidate(row(), "1X2")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row(), "DOUBLE_CHANCE")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: false, strongCandidate: true, strongDoubleChance: true } }), "1X2")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: true, strongCandidate: false, strongDoubleChance: true } }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: false, strongCandidate: true, strongDoubleChance: true } }), "DOUBLE_CHANCE")).toBe(true);
    expect(isEvidenceQualifiedCandidate(row({ details: { evidenceComplete: true, strongCandidate: true, strongDoubleChance: false } }), "DOUBLE_CHANCE")).toBe(false);
  });

  it("never treats rejected or non-prediction records as candidates", () => {
    expect(isEvidenceQualifiedCandidate(row({ status: "ODRZUCONY" }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(row({ kind: "match" }), "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(undefined, "1X2")).toBe(false);
  });
  it("never qualifies baseline-only rows even when legacy flags are true", () => {
    const baseline = row({ details: { evidenceComplete: true, strongCandidate: true, strongDoubleChance: true,
      modelSourceType: "baseline_only", predictionMethod: "neutral-prior-poisson" } });
    expect(isEvidenceQualifiedCandidate(baseline, "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(baseline, "DOUBLE_CHANCE")).toBe(false);
  });
});

describe("prediction display status", () => {
  it("labels a >=75% model candidate as qualified while separately retaining missing-evidence warnings", () => {
    const rejected = row({ status: "ODRZUCONY", details: { evidenceComplete: false, strongCandidate: false, strongDoubleChance: false } });
    expect(getPredictionDisplayStatus(rejected, "1X2", 0.755)).toBe("WSTĘPNA PROGNOZA · BRAK DANYCH UZUPEŁNIAJĄCYCH");
    const candidate = row({ details: { evidenceComplete: false, strongCandidate: true, strongDoubleChance: true } });
    expect(getPredictionDisplayStatus(candidate, "1X2", 0.832)).toBe("KANDYDAT MODELU ≥75%");
    expect(getPredictionDisplayStatus(rejected, "DOUBLE_CHANCE", 0.909)).toBe("WSTĘPNA PROGNOZA · BRAK DANYCH UZUPEŁNIAJĄCYCH");
    expect(isEvidenceQualifiedCandidate(rejected, "1X2")).toBe(false);
    expect(isEvidenceQualifiedCandidate(rejected, "DOUBLE_CHANCE")).toBe(false);
  });

  it("does not call a high probability below threshold when evidence is complete but market qualification fails", () => {
    const notQualified = row({
      status: "ODRZUCONY",
      details: { evidenceComplete: true, strongCandidate: false, strongDoubleChance: false },
    });
    expect(getPredictionDisplayStatus(notQualified, "1X2", 0.80)).toBe("WYSOKIE PRAWDOPODOBIEŃSTWO · WYMAGA KWALIFIKACJI");
    expect(getPredictionDisplayStatus(notQualified, "DOUBLE_CHANCE", 0.91)).toBe("WYSOKIE PRAWDOPODOBIEŃSTWO · NIEKWALIFIKOWANE");
  });

  it("shows qualified status only when evidence and market-specific strong flag pass", () => {
    expect(getPredictionDisplayStatus(row(), "1X2", 0.80)).toBe("KANDYDAT MODELU ≥75%");
  });

  it("shows below-threshold only for probabilities actually below 75%", () => {
    expect(getPredictionDisplayStatus(row({ details: { evidenceComplete: true, strongCandidate: false } }), "1X2", 0.74)).toBe("PONIŻEJ PROGU 75%");
  });
});
