import { describe, expect, it } from "vitest";
import { getSafestPick, hasKickoffPassed, hasKnownKickoff } from "./safest-pick";
import type { TrackerRecord } from "./tracker-store";

function prediction(overrides: Partial<TrackerRecord["details"]> = {}, status = "KANDYDAT"): TrackerRecord {
  return {
    id: "prediction-1",
    kind: "prediction",
    title: "Team A vs Team B",
    status,
    createdAt: "2026-11-17T10:00:00.000Z",
    details: {
      fixtureId: "fixture-1",
      fixtureDate: "2099-06-01",
      fixtureTime: "18:00",
      competition: "Test League",
      evidenceComplete: true,
      dc1x: 0.86,
      dcx2: 0.72,
      dc12: 0.91,
      ...overrides,
    },
  };
}

describe("safest daily pick", () => {
  it("chooses only one highest qualifying Double Chance candidate", () => {
    const result = getSafestPick([
      prediction({ fixtureId: "fixture-1", dc1x: 0.86, dc12: 0.85 }),
      prediction({ fixtureId: "fixture-2", dc1x: 0.88, dcx2: 0.89, dc12: 0.84 }),
    ]);
    expect(result?.fixtureId).toBe("fixture-2");
    expect(result?.market).toBe("X2");
    expect(result?.probability).toBe(0.89);
  });

  it("allows a DC-qualified pick even when it does not pass the 1X2 gate", () => {
    const dcOnly = prediction({ dc1x: 0.84, dcx2: 0.81, dc12: 0.79, strongCandidate: false, strongDoubleChance: true }, "KANDYDAT_DC");
    expect(getSafestPick([dcOnly])?.market).toBe("1X");
  });

  it("qualifies Double Chance from 75%, independently of the 1X2 gate", () => {
    const dcAt75 = prediction({ dc1x: 0.75, dcx2: 0.74, dc12: 0.70, strongCandidate: false, strongDoubleChance: true }, "KANDYDAT_DC");
    expect(getSafestPick([dcAt75])?.market).toBe("1X");
    const below75 = prediction({ dc1x: 0.749, dcx2: 0.74, dc12: 0.70, strongCandidate: false, strongDoubleChance: false }, "ODRZUCONY");
    expect(getSafestPick([below75])).toBeNull();
  });

  it("does not promote a high-probability pick when required evidence is incomplete", () => {
    const incomplete = prediction({ evidenceComplete: false, dc1x: 0.99, dcx2: 0.98, dc12: 0.97 });
    expect(getSafestPick([incomplete])).toBeNull();
  });

  it("limits the dashboard safest pick to the requested Brussels scan date", () => {
    const today = prediction({ fixtureId: "today", fixtureDate: "2099-06-01", fixtureTime: "18:00" });
    const tomorrow = prediction({ fixtureId: "tomorrow", fixtureDate: "2099-06-02", fixtureTime: "18:00", dc1x: 0.99, dcx2: 0.98, dc12: 0.97 });
    expect(getSafestPick([today, tomorrow], 0.75, "2099-06-01")?.fixtureId).toBe("today");
    expect(getSafestPick([tomorrow], 0.75, "2099-06-01")).toBeNull();
  });

  it("does not surface rejected, weak or started predictions", () => {
    expect(getSafestPick([prediction({}, "ODRZUCONY")])).toBeNull();
    expect(getSafestPick([prediction({ dc1x: 0.74, dcx2: 0.73, dc12: 0.749 })])).toBeNull();
    expect(getSafestPick([prediction({ fixtureDate: "2000-01-01" })])).toBeNull();
    expect(getSafestPick([prediction({ fixtureTime: "—" })])).toBeNull();
  });

  it("compares kickoff using Brussels wall-clock date and time", () => {
    expect(hasKickoffPassed("2000-01-01", "12:00")).toBe(true);
    expect(hasKickoffPassed("2099-06-01", "12:00")).toBe(false);
    expect(hasKickoffPassed("2099-06-01", "—")).toBe(false);
    expect(hasKnownKickoff("2099-06-01", "18:00")).toBe(true);
    expect(hasKnownKickoff("2099-06-01", "—")).toBe(false);
    expect(hasKnownKickoff("2099-02-31", "18:00")).toBe(false);
  });
});
