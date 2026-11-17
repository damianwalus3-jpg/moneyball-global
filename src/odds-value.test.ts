import { describe, expect, it } from "vitest";
import type { TrackerRecord } from "./tracker-store";
import { listOddsBookmakers, valueSelectionFromOdds } from "./odds-value";

const now = "2026-11-17T20:00:00.000Z";
function odds(overrides: Partial<TrackerRecord["details"]> = {}, status = "COMPLETE_1X2"): TrackerRecord {
  return {
    id: "odds-1", kind: "odds", title: "Home vs Away · Book A", status,
    createdAt: now,
    details: {
      fixtureId: "fixture-1", bookmaker: "Book A", market: "1X2", complete1X2: true,
      odds1: 2.2, oddsX: 3.4, odds2: 3.1, capturedAt: "2026-11-17T19:30:00.000Z",
      ...overrides,
    },
  };
}
const model = { p1: 0.5, px: 0.25, p2: 0.25 };

describe("verified odds valuation", () => {
  it("calculates decimal-price EV and removes bookmaker margin from market probabilities", () => {
    const result = valueSelectionFromOdds([odds()], "fixture-1", "1", "Book A", model, now);
    expect(result?.decimalOdds).toBe(2.2);
    expect(result?.expectedValue).toBeCloseTo(0.1);
    expect(result?.marketProbabilityNoVig).toBeCloseTo((1 / 2.2) / (1 / 2.2 + 1 / 3.4 + 1 / 3.1));
    expect(result?.fresh).toBe(true);
  });

  it("uses the newest snapshot for the selected bookmaker only", () => {
    const older = odds({ capturedAt: "2026-11-17T18:00:00.000Z", odds1: 1.8 });
    const newer = odds({ capturedAt: "2026-11-17T19:45:00.000Z", odds1: 2.4 });
    const result = valueSelectionFromOdds([newer, older], "fixture-1", "1", "Book A", model, now);
    expect(result?.decimalOdds).toBe(2.4);
    expect(valueSelectionFromOdds([odds()], "fixture-1", "1", "Other Book", model, now)).toBeNull();
  });

  it("rejects incomplete, stale, future-dated and invalid price snapshots", () => {
    expect(valueSelectionFromOdds([odds({}, "INCOMPLETE_1X2")], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ capturedAt: "2026-11-17T10:00:00.000Z" })], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ capturedAt: "2026-11-17T21:00:00.000Z" })], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ oddsX: null })], "fixture-1", "1", "Book A", model, now)).toBeNull();
  });

  it("rejects invalid model probability distributions", () => {
    expect(valueSelectionFromOdds([odds()], "fixture-1", "1", "Book A", { p1: 0.6, px: 0.3, p2: 0.3 }, now)).toBeNull();
  });

  it("lists only bookmakers with fresh complete prices", () => {
    const records = [
      odds(),
      odds({ bookmaker: "Stale", capturedAt: "2026-11-17T10:00:00.000Z" }),
      odds({ bookmaker: "Incomplete", complete1X2: false }, "INCOMPLETE_1X2"),
    ];
    expect(listOddsBookmakers(records, ["fixture-1"], now)).toEqual(["Book A"]);
  });
});
