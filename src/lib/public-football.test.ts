import { describe, expect, it } from "vitest";
import { eventToFixture, PUBLIC_SOCCER_LEAGUES, type EspnEvent } from "./public-football";

describe("public ESPN soccer feed parser", () => {
  const league = PUBLIC_SOCCER_LEAGUES[0]!;
  it("normalizes teams, UTC kickoff and scheduled status", () => {
    const event: EspnEvent = {
      id: "123",
      date: "2026-11-15T17:30:00Z",
      status: { type: { state: "pre" } },
      competitions: [{ competitors: [
        { homeAway: "away", team: { displayName: "Away FC" } },
        { homeAway: "home", team: { displayName: "Home FC" } },
      ] }],
    };
    expect(eventToFixture(event, league)).toMatchObject({
      external_id: "espn:eng.1:123",
      kickoff_at: "2026-11-15T17:30:00.000Z",
      home_team: "Home FC",
      away_team: "Away FC",
      status: "scheduled",
    });
  });

  it("keeps completed scores and identifies live matches", () => {
    const base: EspnEvent = {
      id: "124",
      date: "2026-11-15T17:30:00Z",
      competitions: [{ competitors: [
        { homeAway: "home", score: "2", team: { name: "Home" } },
        { homeAway: "away", score: "1", team: { name: "Away" } },
      ] }],
    };
    expect(eventToFixture({ ...base, status: { type: { state: "post" } } }, league)).toMatchObject({
      status: "finished", home_goals: 2, away_goals: 1,
    });
    expect(eventToFixture({ ...base, status: { type: { state: "in" } } }, league)?.status).toBe("live");
    expect(eventToFixture({ ...base, status: { type: { state: "post", description: "Postponed" } } }, league)?.status).toBe("postponed");
  });

  it("rejects malformed events rather than inventing fixture data", () => {
    expect(eventToFixture({ id: "bad", date: "not-a-date" }, league)).toBeNull();
    expect(PUBLIC_SOCCER_LEAGUES.length).toBeGreaterThan(20);
    expect(new Set(PUBLIC_SOCCER_LEAGUES.map((x) => x.slug)).size).toBe(PUBLIC_SOCCER_LEAGUES.length);
  });
});
