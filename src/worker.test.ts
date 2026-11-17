import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker";

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare OpenLigaDB proxy", () => {
  it("proxies fixture requests, labels the source and caches successful responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response('[{"matchID":1}]', { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    const waitUntil = vi.fn();
    const request = new Request("https://moneyball.example/api/openligadb/matches/bl1/2026");
    const response = await worker.fetch(request, { ASSETS: { fetch: vi.fn() } }, { waitUntil });
    expect(upstream).toHaveBeenCalledWith("https://api.openligadb.de/getmatchdata/bl1/2026", expect.any(Object));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("OpenLigaDB");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=900");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://moneyball.example");
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("encodes team names safely in the history endpoint", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    await worker.fetch(new Request("https://moneyball.example/api/openligadb/team-matches/bl1/2026/Club%20A%20%26%20B"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(upstream.mock.calls[0][0]).toBe("https://api.openligadb.de/getmatchdata/bl1/2026/Club%20A%20%26%20B");
  });

  it("does not cache failed upstream responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/openligadb/leagues/2026"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(503);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("passes non-API requests to Cloudflare static assets", async () => {
    const assetResponse = new Response("app shell", { status: 200 });
    const assetFetch = vi.fn().mockResolvedValue(assetResponse);
    const response = await worker.fetch(new Request("https://moneyball.example/"), { ASSETS: { fetch: assetFetch } }, { waitUntil: vi.fn() });
    expect(assetFetch).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("app shell");
  });
});

describe("odds provider pilot proxy", () => {
  it("reports only whether secrets are configured and never exposes their values", async () => {
    const secret = "do-not-return-this";
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/status"), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: secret, STRIKERAPI_API_KEY: secret,
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(body).toContain('"oddspapi":true');
    expect(body).toContain('"strikerapi":true');
    expect(body).not.toContain(secret);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a pilot request without provider fixture identifiers", async () => {
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "fixtureId or strikerGameId is required" });
  });

  it("requests OddsPapi odds only from the Worker and returns provider data without the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ fixtureId: "fixture-123", hasOdds: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123"), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "private-key-value",
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(fetchMock.mock.calls[0][0].toString()).toContain("/v4/odds?fixtureId=fixture-123");
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("private-key-value");
    expect(body).toContain('"status":"ok"');
    expect(body).not.toContain("private-key-value");
  });

  it("normalizes StrikerAPI moneyline prices to decimal odds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { games: [{
      game_id: "game-1", starts_at: "2026-11-18T18:00:00Z",
      home: { name: "Home FC" }, away: { name: "Away FC" },
      books: [{ provider: "ExampleBook", source: "live", captured_at: "2026-11-17T18:00:00Z", home_ml_close: 100, draw_ml_close: -110, away_ml_close: 250 }],
    }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerGameId=game-1"), {
      ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "private-key-value",
    }, { waitUntil: vi.fn() });
    const body = await response.json() as { results: { strikerapi: { games: Array<{ bookmakers: Array<{ odds1: number; oddsX: number; odds2: number; complete1X2: boolean }> }> } } };
    const book = body.results.strikerapi.games[0].bookmakers[0];
    expect(book.odds1).toBe(2);
    expect(book.oddsX).toBe(1.9091);
    expect(book.odds2).toBe(3.5);
    expect(book.complete1X2).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("private-key-value");
  });

  it("does not call a provider when its Worker secret is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    const body = await response.json() as { results: { oddspapi: { status: string } } };
    expect(body.results.oddspapi.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
