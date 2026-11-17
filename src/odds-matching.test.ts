import { describe, expect, it } from "vitest";
import { auditOddsFixtureMatches, type OddsMatchFixture, type OddsProviderGame } from "./odds-matching";

const fixture = (id: string, overrides: Partial<OddsMatchFixture> = {}): OddsMatchFixture => ({
  id, date: "2026-11-18", time: "18:00", home: "Club Brugge FC", away: "KAA Gent",
  ...overrides,
});
const game = (gameId: string, overrides: Partial<OddsProviderGame> = {}): OddsProviderGame => ({
  gameId, startsAt: "2026-11-18T17:00:00.000Z", home: "Club Brugge", away: "KAA Gent",
  ...overrides,
});

describe("conservative provider fixture matching", () => {
  it("matches normalized club names, accents and Brussels kickoff time", () => {
    const result = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1")]);
    expect(result.matched).toEqual([{ fixtureId: "fx-1", gameId: "game-1", kickoffDifferenceMinutes: 0 }]);
    expect(result.unmatchedFixtureIds).toEqual([]);
    expect(result.ambiguousFixtureIds).toEqual([]);
  });

  it("accepts a small kickoff difference but rejects a large one", () => {
    const close = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1", { startsAt: "2026-11-18T17:25:00.000Z" })]);
    expect(close.matched).toHaveLength(1);
    const far = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1", { startsAt: "2026-11-18T19:00:00.000Z" })]);
    expect(far.matched).toHaveLength(0);
    expect(far.unmatchedFixtureIds).toEqual(["fx-1"]);
  });

  it("never matches reversed home and away teams or another Brussels date", () => {
    const reversed = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1", { home: "KAA Gent", away: "Club Brugge" })]);
    const wrongDate = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1", { startsAt: "2026-11-19T17:00:00.000Z" })]);
    expect(reversed.matched).toHaveLength(0);
    expect(wrongDate.matched).toHaveLength(0);
  });

  it("flags multiple provider candidates as ambiguous instead of guessing", () => {
    const result = auditOddsFixtureMatches([fixture("fx-1")], [game("game-1"), game("game-2")]);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguousFixtureIds).toEqual(["fx-1"]);
  });

  it("flags one provider game claimed by multiple local fixtures as ambiguous", () => {
    const result = auditOddsFixtureMatches([fixture("fx-1"), fixture("fx-2")], [game("game-1")]);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguousFixtureIds.sort()).toEqual(["fx-1", "fx-2"]);
  });

  it("does not match fixtures with unknown kickoff times", () => {
    const result = auditOddsFixtureMatches([fixture("fx-1", { time: "—" })], [game("game-1")]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedFixtureIds).toEqual(["fx-1"]);
  });
});
