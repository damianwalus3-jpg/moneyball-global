import { describe, expect, it } from "vitest";
import { deduplicateFixtures, deriveDoubleChance, quoteThreeLegCoupon, validateOneXTwo, type Fixture } from "./domain";

const probabilities = { home: 0.5, draw: 0.25, away: 0.25 };
const fixture = (id: string, provider = "feed-a"): Fixture => ({
  id, provider, providerFixtureId: id, competitionId: "league-1",
  homeTeamId: "team-a", awayTeamId: "team-b", kickoffUtc: "2026-11-18T18:00:00.000Z",
});

describe("prediction domain", () => {
  it("accepts only normalized 1X2 distributions", () => {
    expect(validateOneXTwo(probabilities)).toBe(true);
    expect(validateOneXTwo({ home: 0.6, draw: 0.3, away: 0.3 })).toBe(false);
    expect(validateOneXTwo({ home: 1.1, draw: -0.1, away: 0 })).toBe(false);
  });

  it("derives Double Chance transparently from 1X2", () => {
    expect(deriveDoubleChance(probabilities)).toEqual({ oneX: 0.75, xTwo: 0.5, oneTwo: 0.75 });
    expect(() => deriveDoubleChance({ home: 0.2, draw: 0.2, away: 0.2 })).toThrow();
  });

  it("removes exact provider duplicates and normalized fixture duplicates", () => {
    const rows = [fixture("100"), fixture("100"), { ...fixture("200", "feed-b"), id: "second" }];
    expect(deduplicateFixtures(rows)).toHaveLength(1);
  });

  it("requires exactly three distinct matches in a coupon", () => {
    expect(() => quoteThreeLegCoupon([{ fixtureId: "a", selection: "1", odds: 1.4 }], 4)).toThrow();
    expect(() => quoteThreeLegCoupon([
      { fixtureId: "a", selection: "1", odds: 1.4 },
      { fixtureId: "a", selection: "1X", odds: 1.3 },
      { fixtureId: "c", selection: "X2", odds: 1.2 },
    ], 4)).toThrow();
  });

  it("calculates compounded odds and paper return", () => {
    const quote = quoteThreeLegCoupon([
      { fixtureId: "a", selection: "1X", odds: 1.3 },
      { fixtureId: "b", selection: "X2", odds: 1.4 },
      { fixtureId: "c", selection: "1", odds: 1.2 },
    ], 4);
    expect(quote.totalOdds).toBeCloseTo(2.184);
    expect(quote.grossReturn).toBeCloseTo(8.736);
    expect(quote.netProfit).toBeCloseTo(4.736);
  });
});
