import { describe, expect, it } from "vitest";
import { getSafestPick, hasKickoffPassed } from "./safest-pick";
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
      prediction({ fixtureId: "fixture-1", dc1x: 0.86, dc12: 0.91 }),
      prediction({ fixtureId: "fixture-2", dc1x: 0.88, dcx2: 0.89, dc12: 0.84 }),
    ]);
    expect(result?.fixtureId).toBe("fixture-2");
    expect(result?.market).toBe("X2");
    expect(result?.probability).toBe(0.89);
  });

  it("does not surface rejected, weak or started predictions", () => {
    expect(getSafestPick([prediction({}, "ODRZUCONY")])).toBeNull();
    expect(getSafestPick([prediction({ dc1x: 0.79, dcx2: 0.77, dc12: 0.78 })])).toBeNull();
    expect(getSafestPick([prediction({ fixtureDate: "2000-01-01" })])).toBeNull();
  });

  it("compares kickoff using Brussels wall-clock date and time", () => {
    expect(hasKickoffPassed("2000-01-01", "12:00")).toBe(true);
    expect(hasKickoffPassed("2099-06-01", "12:00")).toBe(false);
    expect(hasKickoffPassed("2099-06-01", "—")).toBe(false);
  });
});
