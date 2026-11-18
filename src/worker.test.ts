import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker";

afterEach(() => vi.unstubAllGlobals());


describe("FootyNomad public fixture page inspection", () => {
  it("fetches only the public date page and caches its HTML for parser verification", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const html = "<html><h1>Football matches</h1><a href=\"/fixtures/2026-11-18\">date</a><h2>England 1</h2></html>";
    const upstream = vi.fn().mockResolvedValue(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }));
    vi.stubGlobal("fetch", upstream);
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://moneyball.example/api/footynomad/inspect/2026-11-18", { headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } }), { ASSETS: { fetch: vi.fn() } }, { waitUntil });
    expect(upstream.mock.calls[0][0]).toBe("https://footynomad.com/fixtures/2026-11-18");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("FootyNomad");
    expect(atob((await response.json()).htmlBase64)).toBe(html);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it("rejects impossible dates before contacting FootyNomad", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/footynomad/inspect/2026-02-31"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
describe("Cloudflare ESPN scoreboard proxy", () => {
  it("proxies the requested date, validates JSON and caches successful responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [{ id: "1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://moneyball.example/api/espn/scoreboard/20261118", { headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } }), { ASSETS: { fetch: vi.fn() } }, { waitUntil });
    expect(upstream).toHaveBeenCalledWith("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=20261118&limit=1000", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("ESPN");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://moneyball-global-rebuild.damianwalus3.workers.dev");
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("rejects impossible dates without contacting ESPN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/espn/scoreboard/20261131"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_date" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not cache invalid upstream JSON", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>not json</html>", { status: 200 })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/espn/scoreboard/20261118"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "espn_invalid_json" });
    expect(cache.put).not.toHaveBeenCalled();
  });
});

describe("Cloudflare OpenLigaDB proxy", () => {
  it("proxies fixture requests, labels the source and caches successful responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response('[{"matchID":1}]', { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    const waitUntil = vi.fn();
    const request = new Request("https://moneyball.example/api/openligadb/matches/bl1/2026", { headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } });
    const response = await worker.fetch(request, { ASSETS: { fetch: vi.fn() } }, { waitUntil });
    expect(upstream).toHaveBeenCalledWith("https://api.openligadb.de/getmatchdata/bl1/2026", expect.any(Object));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("OpenLigaDB");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=900");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://moneyball-global-rebuild.damianwalus3.workers.dev");
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
  it("answers preflight with an empty 204 response", async () => {
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot", { method: "OPTIONS", headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } }), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://moneyball-global-rebuild.damianwalus3.workers.dev");
  });

  it("reports only whether secrets are configured and never exposes their values", async () => {
    const secret = "do-not-return-this";
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/status"), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: secret, STRIKERAPI_API_KEY: secret, ODDS_PILOT_TOKEN: "pilot-secret-0123456789-abcdef-extra",
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(body).toContain('"oddspapi":true');
    expect(body).toContain('"strikerapi":true');
    expect(body).toContain('"pilotEnabled":true');
    expect(body).not.toContain(secret);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });


  it("fails closed when the owner pilot token is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123"), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "configured-provider-key",
    }, { waitUntil: vi.fn() });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "pilot_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the configured owner token is shorter than 32 characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123", {
      headers: { Authorization: "Bearer short-token" },
    }), { ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "configured-provider-key", ODDS_PILOT_TOKEN: "short-token" }, { waitUntil: vi.fn() });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "pilot_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid owner token before contacting providers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123", {
      headers: { Authorization: "Bearer wrong-token" },
    }), { ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "configured-provider-key", ODDS_PILOT_TOKEN: "correct-token-0123456789-abcdef-extra" }, { waitUntil: vi.fn() });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not grant CORS access to arbitrary origins", async () => {
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/status", {
      headers: { Origin: "https://attacker.example" },
    }), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects a pilot request without provider fixture identifiers", async () => {
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot", { headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" } }), { ASSETS: { fetch: vi.fn() }, ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef" }, { waitUntil: vi.fn() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "fixtureId, strikerGameId or strikerDate is required" });
  });

  it("requests OddsPapi odds only from the Worker and returns provider data without the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ fixtureId: "fixture-123", hasOdds: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123", { headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" } }), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "private-key-value", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(fetchMock.mock.calls[0][0].toString()).toContain("/v4/odds?fixtureId=fixture-123");
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("apiKey")).toBe("private-key-value");
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBeUndefined();
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
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerGameId=game-1", { headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" } }), {
      ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "private-key-value", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
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
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?fixtureId=fixture-123", { headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" } }), { ASSETS: { fetch: vi.fn() }, ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef" }, { waitUntil: vi.fn() });
    const body = await response.json() as { results: { oddspapi: { status: string } } };
    expect(body.results.oddspapi.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches all StrikerAPI odds for one UTC date in a single batch request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { games: [
      {
        game_id: "game-1", starts_at: "2026-11-18T18:00:00Z",
        home: { name: "Home FC" }, away: { name: "Away FC" },
        books: [{ provider: "ExampleBook", source: "live", captured_at: "2026-11-17T18:00:00Z", home_ml_close: 100, draw_ml_close: -110, away_ml_close: 250 }],
      },
      {
        game_id: "game-2", starts_at: "2026-11-18T20:00:00Z",
        home: { name: "Other Home" }, away: { name: "Other Away" }, books: [],
      },
    ] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerDate=2026-11-18", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), { ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "private-key-value", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef" }, { waitUntil: vi.fn() });
    const body = await response.json() as { results: { strikerapi: { lookup: string; games: Array<{ gameId: string }> } } };
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ date: "2026-11-18" });
    expect(body.results.strikerapi.lookup).toBe("utc_date");
    expect(body.results.strikerapi.games.map(game => game.gameId)).toEqual(["game-1", "game-2"]);
  });

  it("rejects invalid or conflicting StrikerAPI date and game lookups before provider calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const env = { ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "configured-provider-key", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef" };
    const invalidDate = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerDate=2026-02-31", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), env, { waitUntil: vi.fn() });
    const conflict = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerDate=2026-11-18&strikerGameId=game-1", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), env, { waitUntil: vi.fn() });
    expect(invalidDate.status).toBe(400);
    expect(conflict.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
