import { describe, expect, it } from "vitest";
import { describeHistoryProvenance, parseHistoryProvenance, shouldAppendPrediction } from "./prediction-record";
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
    const dc = { ...row("dc", [null, null, null]), details: { ...row("dc", [null, null, null]).details, market: "DOUBLE_CHANCE" } };
    expect(shouldAppendPrediction([oneXTwo, dc], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "1X2")).toBe(false);
    expect(shouldAppendPrediction([oneXTwo, dc], "fixture-1", "model-v1", true, "recent-form-goals-poisson", "DOUBLE_CHANCE")).toBe(true);
  });
  it("ignores records from another model or fixture", () => {
    expect(shouldAppendPrediction([row("other", [0.6, 0.2, 0.2])], "fixture-2", "model-v1", true)).toBe(true);
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
