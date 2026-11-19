import { describe, expect, it } from "vitest";
import { brusselsDateToday, getSelectedFixturePredictions } from "./selected-matches";
import type { TrackerRecord } from "./tracker-store";

function prediction(
  id: string,
  fixtureId: string,
  fixtureDate: string,
  fixtureTime: string,
  market: "1X2" | "DOUBLE_CHANCE" = "1X2",
  method = "recent-form-goals-poisson",
  createdAt = "2026-11-18T08:00:00.000Z",
): TrackerRecord {
  return {
    id, kind: "prediction", title: fixtureId, status: "KANDYDAT", createdAt,
    details: { fixtureId, fixtureDate, fixtureTime, market, predictionMethod: method },
  };
}

describe("selected fixture predictions", () => {
  it("uses the Europe/Brussels calendar date", () => {
    expect(brusselsDateToday(new Date("2026-11-18T23:30:00.000Z"))).toBe("2026-11-19");
  });

  it("excludes historical and future-day predictions", () => {
    const rows = getSelectedFixturePredictions([
      prediction("old", "old-match", "2026-11-17", "18:00"),
      prediction("today", "today-match", "2026-11-18", "18:00"),
      prediction("future", "future-match", "2026-11-19", "18:00"),
    ], "2026-11-18");
    expect(rows.map(row => row.fixtureId)).toEqual(["today-match"]);
  });

  it("keeps 1X2 and Double Chance separate and sorts by kickoff", () => {
    const rows = getSelectedFixturePredictions([
      prediction("late-1", "late", "2026-11-18", "21:00"),
      prediction("early-dc", "early", "2026-11-18", "17:00", "DOUBLE_CHANCE"),
      prediction("early-1", "early", "2026-11-18", "17:00"),
    ], "2026-11-18");
    expect(rows.map(row => row.fixtureId)).toEqual(["early", "late"]);
    expect(rows[0].one?.id).toBe("early-1");
    expect(rows[0].dc?.id).toBe("early-dc");
  });

  it("prefers xG history and then the newest row within the same model", () => {
    const rows = getSelectedFixturePredictions([
      prediction("goals-new", "match", "2026-11-18", "19:00", "1X2", "recent-form-goals-poisson", "2026-11-18T10:00:00.000Z"),
      prediction("xg-old", "match", "2026-11-18", "19:00", "1X2", "pitchapi-recent-xg-poisson", "2026-11-18T08:00:00.000Z"),
      prediction("xg-new", "match", "2026-11-18", "19:00", "1X2", "pitchapi-recent-xg-poisson", "2026-11-18T11:00:00.000Z"),
    ], "2026-11-18");
    expect(rows[0].one?.id).toBe("xg-new");
  });

  it("pairs markets across different source fixture IDs for the same canonical match", () => {
    const one = prediction("flash-one", "flashscore:100", "2026-11-18", "19:00");
    const dc = prediction("footy-dc", "footynomad:200", "2026-11-18", "19:00", "DOUBLE_CHANCE");
    const withIdentity = (row: TrackerRecord): TrackerRecord => ({
      ...row,
      title: "2026-11-18 · Club Brugge vs KAA Gent",
      details: { ...row.details, home: "Club Brugge", away: "KAA Gent", competition: "Belgian Pro League" },
    });
    const rows = getSelectedFixturePredictions([withIdentity(one), withIdentity(dc)], "2026-11-18");
    expect(rows).toHaveLength(1);
    expect(rows[0].one?.id).toBe("flash-one");
    expect(rows[0].dc?.id).toBe("footy-dc");
  });
  it("returns no records for an invalid scan date", () => {
    expect(getSelectedFixturePredictions([prediction("one", "match", "2026-11-18", "18:00")], "18-11-2026")).toEqual([]);
  });
});
