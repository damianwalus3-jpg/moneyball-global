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
  it("does not append another prediction once a valid one exists", () => {
    expect(shouldAppendPrediction([row("valid", [0.6, 0.2, 0.2])], "fixture-1", "model-v1", true)).toBe(false);
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
