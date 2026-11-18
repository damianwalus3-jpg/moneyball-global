import { describe, expect, it } from "vitest";
import type { TrackerRecord } from "./tracker-store";
import { listFreshOddsSnapshots, listOddsBookmakers, shouldAutoFetchDailyOdds, valueSelectionFromOdds } from "./odds-value";

const now = "2026-11-17T20:00:00.000Z";
function odds(overrides: Partial<TrackerRecord["details"]> = {}, status = "COMPLETE_1X2"): TrackerRecord {
  return {
    id: "odds-1", kind: "odds", title: "Home vs Away · Book A", status,
    createdAt: now,
    details: {
      fixtureId: "fixture-1", bookmaker: "Book A", market: "1X2", complete1X2: true,
      odds1: 2.2, oddsX: 3.4, odds2: 3.1, capturedAt: "2026-11-17T19:50:00.000Z",
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
    const newer = odds({ capturedAt: "2026-11-17T19:55:00.000Z", odds1: 2.4 });
    const result = valueSelectionFromOdds([newer, older], "fixture-1", "1", "Book A", model, now);
    expect(result?.decimalOdds).toBe(2.4);
    expect(valueSelectionFromOdds([odds()], "fixture-1", "1", "Other Book", model, now)).toBeNull();
  });

  it("rejects incomplete, stale, future-dated and invalid price snapshots", () => {
    expect(valueSelectionFromOdds([odds({}, "INCOMPLETE_1X2")], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ capturedAt: "2026-11-17T10:00:00.000Z" })], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ capturedAt: "2026-11-17T21:00:00.000Z" })], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ capturedAt: "2026-11-17T18:59:00.000Z" })], "fixture-1", "1", "Book A", model, now)).toBeNull();
    expect(valueSelectionFromOdds([odds({ oddsX: null })], "fixture-1", "1", "Book A", model, now)).toBeNull();
  });

  it("rejects invalid model probability distributions", () => {
    expect(valueSelectionFromOdds([odds()], "fixture-1", "1", "Book A", { p1: 0.6, px: 0.3, p2: 0.3 }, now)).toBeNull();
  });

  it("shows only complete odds captured within the 60-minute provider refresh window", () => {
    const rows = [
      odds({ capturedAt: "2026-11-17T19:55:00.000Z" }),
      odds({ id: "stale", capturedAt: "2026-11-17T18:59:00.000Z" }),
      odds({ id: "future", capturedAt: "2026-11-17T20:01:00.000Z" }),
      odds({ id: "incomplete", complete1X2: false }, "INCOMPLETE_1X2"),
      odds({ id: "other", fixtureId: "fixture-2" }),
    ];
    expect(listFreshOddsSnapshots(rows, "fixture-1", now).map(row => row.id)).toEqual(["odds-1"]);
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

describe("automatic daily odds fetch guard", () => {
  const base = { fixtureDate: "2026-11-18", tokenSaved: true, providerReady: true, lastSuccessfulDate: "", lastAttemptedDate: "" };
  it("allows one automatic fetch when the owner token is saved", () => {
    expect(shouldAutoFetchDailyOdds(base)).toBe(true);
  });
  it("does not fetch without the owner token or after a successful fetch", () => {
    expect(shouldAutoFetchDailyOdds({ ...base, tokenSaved: false })).toBe(false);
    expect(shouldAutoFetchDailyOdds({ ...base, providerReady: false })).toBe(false);
    expect(shouldAutoFetchDailyOdds({ ...base, lastSuccessfulDate: "2026-11-18" })).toBe(false);
  });
  it("does not repeat an attempted fetch after reloads or 15-minute scans", () => {
    expect(shouldAutoFetchDailyOdds({ ...base, lastAttemptedDate: "2026-11-18" })).toBe(false);
  });
  it("rejects malformed calendar dates", () => {
    expect(shouldAutoFetchDailyOdds({ ...base, fixtureDate: "2026-02-30" })).toBe(false);
    expect(shouldAutoFetchDailyOdds({ ...base, fixtureDate: "not-a-date" })).toBe(false);
  });
});
