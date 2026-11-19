import { describe, expect, it } from "vitest";
import { brusselsUtcDayWindow, discoverOddsPapiMarkets, matchOddsPapiFixtures, parseOddsPapiQuotes, selectOddsPapiBookmakers } from "./oddspapi";
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
    const reversed = { fixtureId: "op-1", tournamentId: 77, startTime: "2026-11-19T18:00:00.000Z", participant1Name: "KAA Gent", participant2Name: "Club Brugge" };
    const matching = { ...reversed, participant1Name: "Club Brugge FC", participant2Name: "KAA Gent" };
    expect(matchOddsPapiFixtures([fixture], [reversed]).matched).toHaveLength(0);
    expect(matchOddsPapiFixtures([fixture], [matching, { ...matching, fixtureId: "op-2" }]).ambiguousFixtureIds).toEqual(["local-1"]);
  });
  it("discovers the direct full-time 1X2 and Double Chance markets from the provider catalogue", () => {
    const catalog = [
      { marketId: 101, marketName: "Full Time Result", marketType: "1x2", sportId: 10, period: "fulltime", playerProp: false,
        outcomes: [{ outcomeId: 101, outcomeName: "1" }, { outcomeId: 102, outcomeName: "X" }, { outcomeId: 103, outcomeName: "2" }] },
      { marketId: 202, marketName: "Double Chance", marketType: "double_chance", sportId: 10, period: "fulltime", playerProp: false,
        outcomes: [{ outcomeId: 201, outcomeName: "1X" }, { outcomeId: 202, outcomeName: "X2" }, { outcomeId: 203, outcomeName: "12" }] },
      { marketId: 303, marketName: "Double Chance First Half", marketType: "double_chance", sportId: 10, period: "firsthalf", playerProp: false,
        outcomes: [{ outcomeId: 301, outcomeName: "1X" }, { outcomeId: 302, outcomeName: "X2" }, { outcomeId: 303, outcomeName: "12" }] },
    ];
    expect(discoverOddsPapiMarkets(catalog)).toEqual([
      { marketId: "101", marketType: "1X2", outcomeIds: { "1": "101", X: "102", "2": "103" } },
      { marketId: "202", marketType: "DOUBLE_CHANCE", outcomeIds: { "1X": "201", X2: "202", "12": "203" } },
    ]);
  });
  it("parses direct Double Chance odds independently from 1X2", () => {
    const catalog = discoverOddsPapiMarkets([
      { marketId: 101, marketName: "Full Time Result", marketType: "1x2", sportId: 10, period: "fulltime", playerProp: false,
        outcomes: [{ outcomeId: 101, outcomeName: "1" }, { outcomeId: 102, outcomeName: "X" }, { outcomeId: 103, outcomeName: "2" }] },
      { marketId: 202, marketName: "Double Chance", marketType: "double_chance", sportId: 10, period: "fulltime", playerProp: false,
        outcomes: [{ outcomeId: 201, outcomeName: "1X" }, { outcomeId: 202, outcomeName: "X2" }, { outcomeId: 203, outcomeName: "12" }] },
    ]);
    const player = (price: number) => ({ active: true, price, changedAt: "2026-11-19T10:00:00.000Z" });
    const payload = [{ fixtureId: "op-dc", bookmakerOdds: { "bwin.be": {
      bookmakerIsActive: true, suspended: false, markets: {
        "101": { marketActive: true, outcomes: { "101": { players: { "0": player(2.1) } }, "102": { players: { "0": player(3.2) } }, "103": { players: { "0": player(3.5) } } } },
        "202": { marketActive: true, outcomes: { "201": { players: { "0": player(1.25) } }, "202": { players: { "0": player(1.4) } }, "203": { players: { "0": player(1.3) } } } },
      },
    } } }];
    const rows = parseOddsPapiQuotes(payload, { "bwin.be": "Bwin Belgium" }, catalog);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.market === "DOUBLE_CHANCE")).toMatchObject({
      odds1x: 1.25, oddsX2: 1.4, odds12: 1.3, completeDoubleChance: true, complete1X2: false,
    });
    expect(rows.find(row => row.market === "1X2")).toMatchObject({
      odds1: 2.1, oddsX: 3.2, odds2: 3.5, complete1X2: true, completeDoubleChance: false,
    });
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
    expect(rows[0]).toMatchObject({ bookmaker: "Bwin BE", complete1X2: true, odds1: 2.1, oddsX: 3.2, odds2: 3.5, timestampBasis: "price_changed_at", capturedAt: "2026-11-19T10:00:00.000Z" });
    expect(rows[1].complete1X2).toBe(false);
  });
  it("uses the oldest of all three price timestamps for market freshness", () => {
    const price = (value: number, changedAt: string) => ({ active: true, price: value, changedAt });
    const payload = [{
      fixtureId: "op-2",
      bookmakerOdds: {
        "bwin.be": {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            "101": {
              marketActive: true,
              outcomes: {
                "101": { players: { "0": price(2.1, "2026-11-19T10:05:00.000Z") } },
                "102": { players: { "0": price(3.2, "2026-11-19T09:20:00.000Z") } },
                "103": { players: { "0": price(3.5, "2026-11-19T10:02:00.000Z") } },
              },
            },
          },
        },
      },
    }];
    expect(parseOddsPapiQuotes(payload, {}).map(row => row.capturedAt)).toEqual(["2026-11-19T09:20:00.000Z"]);
  });
  it("does not treat a missing or invalid price timestamp as current", () => {
    const payload = [{ fixtureId: "op-1", updatedAt: "invalid", bookmakerOdds: { "bwin.be": { bookmakerIsActive: true, suspended: false, markets: {
      "101": { marketActive: true, outcomes: { "101": { players: { "0": { active: true, price: 2 } } }, "102": { players: { "0": { active: true, price: 3 } } }, "103": { players: { "0": { active: true, price: 4 } } } } },
    } } } }];
    expect(parseOddsPapiQuotes(payload, {}).map(row => row.capturedAt)).toEqual([null]);
  });
  it("limits selected bookmakers to both target feeds and account entitlements", () => {
    const catalog = [{ bookmakerName: "Bwin BE", slug: "bwin.be" }, { bookmakerName: "Bwin FR", slug: "bwin.fr" }, { bookmakerName: "Pinnacle", slug: "pinnacle" }];
    expect(selectOddsPapiBookmakers(catalog, ["bwin.be", "pinnacle", "bwin.fr"]).map(row => row.slug)).toEqual(["bwin.be", "pinnacle"]);
    const belgianCatalog = [{ bookmakerName: "Unibet BE", slug: "unibet.be" }, { bookmakerName: "Bingoal", slug: "bingoal.be" }];
    expect(selectOddsPapiBookmakers(belgianCatalog, ["unibet.be", "bingoal.be"]).map(row => row.slug)).toEqual(["unibet.be", "bingoal.be"]);
  });
});
