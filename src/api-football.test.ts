import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApiFootballEnrichment, fetchApiFootballInjuriesForDate } from "./api-football";

afterEach(() => vi.unstubAllGlobals());

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
    const result = await fetchApiFootballInjuriesForDate("2026-11-19");
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
