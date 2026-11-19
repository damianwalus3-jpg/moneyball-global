import { describe, expect, it } from "vitest";
import { describeHistoryProvenance, hasMissingPredictionMarket, hasValidPredictionMarket, parseHistoryProvenance, shouldAppendPrediction, shouldRetryPredictionAttempt, shouldRetryPredictionWithEvidence } from "./prediction-record";
import type { TrackerRecord } from "./tracker-store";

function row(id: string, probabilities: [number | null, number | null, number | null]): TrackerRecord {
  return { id, kind: "prediction", title: id, status: "ODRZUCONY", createdAt: "2026-11-17T08:00:00Z", details: { fixtureId: "fixture-1", model: "model-v1", p1: probabilities[0], px: probabilities[1], p2: probabilities[2] } };
}

describe("prediction record refresh policy", () => {
  it("records the first attempt even when no probabilities are available", () => {
    expect(shouldAppendPrediction([], "fixture-1", "model-v1", false)).toBe(true);
  });
  it("does not duplicate repeated failed lookups", () => {
    expect(shouldAppendPrediction([row("failed", [null, null, null])], "fixture-1", "model-v1", false)).toBe(false);
  });
  it("allows a later successful analysis to supersede an earlier failed lookup", () => {
    expect(shouldAppendPrediction([row("failed", [null, null, null])], "fixture-1", "model-v1", true)).toBe(true);
  });
  it("does not append another prediction once an evidence-backed valid one exists", () => {
    const valid = { ...row("valid", [0.6, 0.2, 0.2]), details: { ...row("valid", [0.6, 0.2, 0.2]).details, predictionMethod: "recent-form-goals-poisson" } };
    expect(shouldAppendPrediction([valid], "fixture-1", "model-v1", true, "recent-form-goals-poisson")).toBe(false);
  });
  it("appends a new immutable prediction when the evidence gaps change", () => {
    const prior = { ...row("valid", [0.6, 0.2, 0.2]), details: { ...row("valid", [0.6, 0.2, 0.2]).details, evidenceComplete: false, evidenceGaps: "xG, składy" } };
    expect(shouldAppendPrediction([prior], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2", false, "składy")).toBe(true);
    expect(shouldAppendPrediction([prior], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2", false, "xG, składy")).toBe(false);
    expect(shouldAppendPrediction([prior], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2", true, "")).toBe(true);
  });

  it("re-runs immutable prediction when qualification policy version changes", () => {
    const prior = { ...row("old-policy", [0.3, 0.2, 0.5]), details: { ...row("old-policy", [0.3, 0.2, 0.5]).details, qualificationPolicyVersion: 1 } };
    expect(shouldAppendPrediction([prior], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2", false, "składy", 2)).toBe(true);
    const current = { ...prior, details: { ...prior.details, qualificationPolicyVersion: 2, evidenceComplete: false, evidenceGaps: "składy" } };
    expect(shouldAppendPrediction([current], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2", false, "składy", 2)).toBe(false);
  });

  it("allows an evidence-backed forecast to supersede a neutral-prior placeholder", () => {
    const fallback = { ...row("fallback", [0.34, 0.32, 0.34]), details: { ...row("fallback", [0.34, 0.32, 0.34]).details, predictionMethod: "neutral-prior-poisson" } };
    expect(shouldAppendPrediction([fallback], "fixture-1", "model-v1", true, "recent-form-goals-poisson")).toBe(true);
  });
  it("does not duplicate a neutral-prior placeholder when a retry still has no better data", () => {
    const fallback = { ...row("fallback", [0.34, 0.32, 0.34]), details: { ...row("fallback", [0.34, 0.32, 0.34]).details, predictionMethod: "neutral-prior-poisson" } };
    expect(shouldAppendPrediction([fallback], "fixture-1", "model-v1", true, "neutral-prior-poisson")).toBe(false);
  });
  it("keeps 1X2 and Double Chance records independent for the same fixture/model", () => {
    const oneXTwo = row("one-x-two", [0.6, 0.2, 0.2]);
    const dc = { ...row("dc", [null, null, null]), details: { ...row("dc", [null, null, null]).details, market: "DOUBLE_CHANCE", p1x: 0.8, px2: 0.7, p12: 0.5 } };
    expect(shouldAppendPrediction([oneXTwo, dc], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2")).toBe(false);
    expect(shouldAppendPrediction([oneXTwo, dc], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "DOUBLE_CHANCE")).toBe(false);
  });
  it("ignores records from another model or fixture", () => {
    expect(shouldAppendPrediction([row("other", [0.6, 0.2, 0.2])], "fixture-2", "model-v1", true)).toBe(true);
  });
});



describe("incomplete market retry cooldown", () => {
  it("allows the first attempt when no previous timestamp exists", () => {
    expect(shouldRetryPredictionAttempt(undefined, 1000, 6000)).toBe(true);
  });
  it("blocks a repeated failed attempt inside the cooldown", () => {
    expect(shouldRetryPredictionAttempt(1000, 5999, 5000)).toBe(false);
  });
  it("retries valid probability rows when evidence is incomplete, but respects cooldown", () => {
    const prior = { ...row("valid", [0.6, 0.2, 0.2]), details: { ...row("valid", [0.6, 0.2, 0.2]).details, evidenceComplete: false, qualificationPolicyVersion: 2 } };
    expect(shouldRetryPredictionWithEvidence(prior, "1X2", undefined, 10000, 5000)).toBe(true);
    expect(shouldRetryPredictionWithEvidence(prior, "1X2", 9000, 10000, 5000)).toBe(false);
    expect(shouldRetryPredictionWithEvidence({ ...prior, details: { ...prior.details, evidenceComplete: true } }, "1X2", undefined, 10000, 5000)).toBe(false);
  });

  it("allows a retry exactly when the cooldown expires", () => {
    expect(shouldRetryPredictionAttempt(1000, 6000, 5000)).toBe(true);
  });
  it("treats malformed timestamps as an eligible first attempt", () => {
    expect(shouldRetryPredictionAttempt("invalid", 1000, 5000)).toBe(true);
  });
});

describe("fixture market repair detection", () => {
  it("requests analysis when a fixture has only a 1X2 record", () => {
    expect(hasMissingPredictionMarket([row("one", [0.6, 0.2, 0.2])], "fixture-1")).toBe(true);
  });
  it("requests analysis when a fixture has only a Double Chance record", () => {
    const dc = { ...row("dc", [null, null, null]), details: { ...row("dc", [null, null, null]).details, market: "DOUBLE_CHANCE", p1x: 0.8, px2: 0.7, p12: 0.6 } };
    expect(hasMissingPredictionMarket([dc], "fixture-1")).toBe(true);
  });
  it("does not requeue a fixture once both independent market records exist", () => {
    const one = row("one", [0.6, 0.2, 0.2]);
    const dc = { ...row("dc", [null, null, null]), details: { ...row("dc", [null, null, null]).details, market: "DOUBLE_CHANCE", p1x: 0.8, px2: 0.7, p12: 0.6 } };
    expect(hasMissingPredictionMarket([one, dc], "fixture-1")).toBe(false);
  });
  it("detects a present but unusable Double Chance row as an incomplete market", () => {
    const invalidDc = { ...row("dc-invalid", [null, null, null]), details: { ...row("dc-invalid", [null, null, null]).details, market: "DOUBLE_CHANCE", p1x: null, px2: null, p12: null } };
    expect(hasValidPredictionMarket([invalidDc], "fixture-1", "DOUBLE_CHANCE")).toBe(false);
  });
  it("accepts Double Chance only when all three probabilities sum to two", () => {
    const validDc = { ...row("dc-valid", [null, null, null]), details: { ...row("dc-valid", [null, null, null]).details, market: "DOUBLE_CHANCE", p1x: 0.8, px2: 0.7, p12: 0.5 } };
    const invalidDc = { ...validDc, id: "dc-bad", details: { ...validDc.details, p12: 0.4 } };
    expect(hasValidPredictionMarket([validDc], "fixture-1", "DOUBLE_CHANCE")).toBe(true);
    expect(hasValidPredictionMarket([invalidDc], "fixture-1", "DOUBLE_CHANCE")).toBe(false);
  });
  it("checks the latest row for the requested model rather than another model", () => {
    const valid = row("valid", [0.6, 0.2, 0.2]);
    const invalidOther = { ...row("other-model", [null, null, null]), details: { ...row("other-model", [null, null, null]).details, model: "model-v2" } };
    expect(hasValidPredictionMarket([valid, invalidOther], "fixture-1", "1X2", "model-v1")).toBe(true);
    expect(hasValidPredictionMarket([valid, invalidOther], "fixture-1", "1X2", "model-v2")).toBe(false);
  });
  it("does not confuse another fixture's market rows", () => {
    expect(hasMissingPredictionMarket([row("other", [0.6, 0.2, 0.2])], "fixture-2")).toBe(true);
  });
});

describe("history provenance metadata", () => {
  it("decodes multi-source history details without losing sample counts", () => {
    const value = JSON.stringify({
      home: { source: "OpenLigaDB + ESPN", matches: 5, homeMatches: 3, awayMatches: 2, sourceUpdatedAt: "2026-11-18T08:00:00Z" },
      away: { source: "OpenFootball", matches: 4, homeMatches: 2, awayMatches: 2 },
      cutoffDateExclusive: "2026-11-18",
    });
    const parsed = parseHistoryProvenance(value);
    expect(parsed?.home?.matches).toBe(5);
    expect(parsed?.away?.source).toBe("OpenFootball");
    expect(describeHistoryProvenance(value)).toContain("Dane wyłącznie sprzed: 2026-11-18");
  });
  it("preserves the actual recent team matches and labels goals/results as not xG", () => {
    const value = JSON.stringify({
      home: { source: "OpenLigaDB", matches: 3, homeMatches: 2, awayMatches: 1,
        recentMatches: [{ date: "2026-11-16", opponent: "Team B", venue: "H", goalsFor: 2, goalsAgainst: 1, result: "W" }] },
      away: { source: "ESPN", matches: 3, homeMatches: 1, awayMatches: 2,
        recentMatches: [{ date: "2026-11-15", opponent: "Team C", venue: "A", goalsFor: 0, goalsAgainst: 1, result: "L" }] },
      cutoffDateExclusive: "2026-11-18", semantics: "Bramki/wyniki historyczne — nie xG.",
    });
    const parsed = parseHistoryProvenance(value);
    expect(parsed?.home?.recentMatches?.[0]).toMatchObject({ opponent: "Team B", venue: "H", goalsFor: 2, goalsAgainst: 1 });
    expect(describeHistoryProvenance(value)).toContain("2026-11-16 (dom) 2:1 vs Team B (W)");
    expect(describeHistoryProvenance(value)).toContain("nie xG");
  });
  it("handles legacy, empty and malformed Tracker values safely", () => {
    expect(parseHistoryProvenance(null)).toBeNull();
    expect(parseHistoryProvenance("")).toBeNull();
    expect(parseHistoryProvenance("{broken")).toBeNull();
    expect(describeHistoryProvenance(undefined)).toContain("Brak zapisanych");
  });
  it("rejects invalid sample counts", () => {
    const parsed = parseHistoryProvenance(JSON.stringify({ home: { matches: -2, homeMatches: 1.5, source: "ESPN" } }));
    expect(parsed?.home?.matches).toBeUndefined();
    expect(parsed?.home?.homeMatches).toBeUndefined();
    expect(parsed?.home?.source).toBe("ESPN");
  });
});
