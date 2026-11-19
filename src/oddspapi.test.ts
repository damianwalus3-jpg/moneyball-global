import { describe, expect, it } from "vitest";
import { brusselsUtcDayWindow, matchOddsPapiFixtures, parseOddsPapiQuotes, selectOddsPapiBookmakers } from "./oddspapi";
describe("OddsPapi adapter", () => {
  it("converts Brussels local day to the correct UTC window across winter and summer time", () => {
    expect(brusselsUtcDayWindow("2026-11-19")).toEqual({ from: "2026-11-18T23:00:00.000Z", to: "2026-11-19T23:00:00.000Z" });
    expect(brusselsUtcDayWindow("2026-07-19")).toEqual({ from: "2026-07-18T22:00:00.000Z", to: "2026-07-19T22:00:00.000Z" });
  });
  it("matches only same teams, same Brussels date and close kickoff; preserves provider tournament id", () => {
    const result = matchOddsPapiFixtures(
      [{ id: "local-1", date: "2026-11-19", time: "19:00", home: "Club Brugge", away: "KAA Gent" }],
      [{ fixtureId: "op-1", tournamentId: 77, startTime: "2026-11-19T18:00:00.000Z", participant1Name: "Club Brugge FC", participant2Name: "KAA Gent" }],
    );
    expect(result.matched).toEqual([{ fixtureId: "local-1", providerFixtureId: "op-1", tournamentId: 77, kickoffDifferenceMinutes: 0 }]);
  });
  it("never guesses ambiguous or reversed fixtures", () => {
    const fixture = { id: "local-1", date: "2026-11-19", time: "19:00", home: "Club Brugge", away: "KAA Gent" };
    const provider = { fixtureId: "op-1", tournamentId: 77, startTime: "2026-11-19T18:00:00.000Z", participant1Name: "KAA Gent", participant2Name: "Club Brugge" };
    expect(matchOddsPapiFixtures([fixture], [provider]).matched).toHaveLength(0);
    expect(matchOddsPapiFixtures([fixture], [provider, { ...provider, fixtureId: "op-2" }]).ambiguousFixtureIds).toEqual(["local-1"]);
  });
  it("accepts only active unsuspended complete 1X2 prices and records source timestamps", () => {
    const player = (price: number) => ({ active: true, price, changedAt: "2026-11-19T10:00:00.000Z" });
    const payload = [{ fixtureId: "op-1", updatedAt: "2026-11-19T09:00:00.000Z", bookmakerOdds: {
      "bwin.be": { bookmakerIsActive: true, suspended: false, fixturePath: "https://sports.bwin.be/event", markets: {
        "101": { marketActive: true, outcomes: { "101": { players: { "0": player(2.1) } }, "102": { players: { "0": player(3.2) } }, "103": { players: { "0": player(3.5) } } } },
      } },
      "bwin.fr": { bookmakerIsActive: false, suspended: true, markets: { "101": { marketActive: true, outcomes: { "101": { players: { "0": player(2.1) } }, "102": { players: { "0": player(3.2) } }, "103": { players: { "0": player(3.5) } } } } } },
    } }];
    const rows = parseOddsPapiQuotes(payload, { "bwin.be": "Bwin BE", "bwin.fr": "Bwin FR" });
    expect(rows[0]).toMatchObject({ bookmaker: "Bwin BE", complete1X2: true, odds1: 2.1, oddsX: 3.2, odds2: 3.5, timestampBasis: "price_changed_at" });
    expect(rows[1].complete1X2).toBe(false);
  });
  it("does not treat a missing or invalid price timestamp as current", () => {
    const payload = [{ fixtureId: "op-1", updatedAt: "invalid", bookmakerOdds: { "bwin.be": { bookmakerIsActive: true, suspended: false, markets: {
      "101": { marketActive: true, outcomes: { "101": { players: { "0": { active: true, price: 2 } } }, "102": { players: { "0": { active: true, price: 3 } } }, "103": { players: { "0": { active: true, price: 4 } } } } },
    } } }];
    expect(parseOddsPapiQuotes(payload, {}).map(row => row.capturedAt)).toEqual([null]);
  });
  it("limits selected bookmakers to both target feeds and account entitlements", () => {
    const catalog = [{ bookmakerName: "Bwin BE", slug: "bwin.be" }, { bookmakerName: "Bwin FR", slug: "bwin.fr" }, { bookmakerName: "Pinnacle", slug: "pinnacle" }];
    expect(selectOddsPapiBookmakers(catalog, ["bwin.be", "pinnacle", "bwin.fr"]).map(row => row.slug)).toEqual(["bwin.be", "pinnacle"]);
  });
});
