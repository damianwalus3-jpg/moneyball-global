import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApiFootballTrackerDetails, fetchApiFootballEnrichment, fetchApiFootballFixturesForDate, fetchApiFootballInjuriesForDate, resetApiFootballRequestThrottleForTests } from "./api-football";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetApiFootballRequestThrottleForTests(); });

describe("API-Football Pro batch client", () => {
  it("deduplicates IDs and fetches at most 20 fixtures per request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://app.example");
      const ids = (url.searchParams.get("ids") ?? "").split("-");
      return new Response(JSON.stringify({
        provider: "API-Football Pro", generatedAt: "2026-11-19T00:00:00Z",
        fixtures: ids.map(id => ({ fixture: { id: Number(id) }, events: [], lineups: [], statistics: [], players: [] })),
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const ids = Array.from({ length: 21 }, (_, index) => String(index + 1)).concat(["1", "invalid"]);
    const result = await fetchApiFootballEnrichment(ids, 0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[0][0]), "https://app.example").searchParams.get("ids")?.split("-")).toHaveLength(20);
    expect(new URL(String(fetchMock.mock.calls[1][0]), "https://app.example").searchParams.get("ids")).toBe("21");
    expect(result.size).toBe(21);
    expect(result.get("21")?.fixture?.id).toBe(21);
  });


  it("routes the daily fixtures feed through the same API-Football client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "API-Football Pro", generatedAt: "2026-11-19T00:00:00Z", results: 1, fixtures: [{ fixture: { id: 123 } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const payload = await fetchApiFootballFixturesForDate("2026-11-19", 0);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/api-football/fixtures/2026-11-19");
    expect(payload.fixtures).toHaveLength(1);
  });

  it("propagates a provider rate limit instead of treating the batch as successful", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "api_football_rate_limited", message: "Too many requests", retryAfterSeconds: 60,
    }), { status: 429 })));
    await expect(fetchApiFootballEnrichment(["123"], 0)).rejects.toThrow("Too many requests (spróbuj ponownie za 60 s)");
  });
});

describe("API-Football daily injury feed", () => {
  it("uses a single Brussels-local date query for the entire matchday", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "API-Football Pro", generatedAt: "2026-11-19T00:00:00Z",
      injuries: [{ fixture: { id: 123 }, team: { name: "Home" }, player: { name: "Player", type: "Missing Fixture", reason: "Suspended" } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchApiFootballInjuriesForDate("2026-11-19", 0);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/api-football/injuries?date=2026-11-19");
    expect(result).toHaveLength(1);
    expect(result[0].player?.reason).toBe("Suspended");
  });

  it("rejects invalid dates before using the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchApiFootballInjuriesForDate("2026-02-31")).rejects.toThrow("Nieprawidłowa data");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("API-Football Tracker storage", () => {
  const fixture = {
    fixture: { id: 123 }, events: [{ type: "Goal" }], lineups: [{ formation: "4-3-3" }],
    statistics: [{ team: { name: "Home" }, statistics: [{ type: "Shots", value: 10 }] }],
    players: [{ team: { name: "Home" }, players: [{ player: { name: "Player" } }] }],
  };
  const injuries = [{ fixture: { id: 123 }, player: { name: "Player", reason: "Injured" } }];
  it("stores compact metadata on all prediction rows and the full payload only on one primary row", () => {
    const compact = buildApiFootballTrackerDetails(fixture, injuries, false, "2026-11-19T04:00:00Z");
    expect(compact).toMatchObject({
      apiFootballFixtureId: 123, apiFootballEventsCount: 1, apiFootballLineupsCount: 1,
      apiFootballTeamStatisticsCount: 1, apiFootballPlayerStatisticsCount: 1,
      apiFootballInjuriesCount: 1, apiFootballDataObservedAt: "2026-11-19T04:00:00Z",
    });
    expect(compact).not.toHaveProperty("apiFootballFixtureData");
    expect(compact).not.toHaveProperty("apiFootballInjuries");
    const full = buildApiFootballTrackerDetails(fixture, injuries, true, "2026-11-19T04:00:00Z");
    expect(JSON.parse(full.apiFootballFixtureData ?? "{}")).toMatchObject({ fixture: { id: 123 }, events: [{ type: "Goal" }] });
    expect(JSON.parse(full.apiFootballInjuries ?? "[]")).toHaveLength(1);
  });
});

describe("API-Football shared quota pacing", () => {
  it("fails fast across endpoint types during Retry-After and retries only after cooldown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "api_football_rate_limited", message: "Too many requests", retryAfterSeconds: 2 }), {
        status: 429, headers: { "Retry-After": "2" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ provider: "API-Football Pro", results: 0, fixtures: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchApiFootballEnrichment(["123"], 0)).rejects.toThrow("Too many requests");
    await expect(fetchApiFootballFixturesForDate("2026-11-19", 0)).rejects.toThrow("API-Football limit aktywny (spróbuj ponownie za 2 s)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(fetchApiFootballFixturesForDate("2026-11-19", 0)).resolves.toMatchObject({ results: 0, fixtures: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
