import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { parseFootyNomadFixtures, parseFlashscoreFixtures } from "./worker";

afterEach(() => vi.unstubAllGlobals());



const FOOTYNOMAD_SAMPLE = [
  "<html><h1>Football matches on 18 November 2026</h1>",
  '<h2>World <span>1</span></h2><details class="league-group"><summary><a href="/league/1">UEFA Champions League Women</a></summary><div>',
  '<a href="/fixture/101-hacken-w-vs-city-w" class="ticket ticket-ns"><span class="ticket-stub"><b><time datetime="2026-11-17T23:30:00Z">23:30</time></b></span><span class="ticket-body"><span class="ticket-home">Häcken W</span><span class="ticket-away">Manchester City W</span></span></a>',
  "</div></details>",
  '<h2>World <span>2</span></h2><details class="league-group"><summary><a href="/league/4">Concacaf Nations League</a></summary><div>',
  '<a href="/fixture/104-french-guiana-vs-st-vincent" class="ticket ticket-ns"><time datetime="2026-11-18T19:00:00Z">19:00</time><span class="ticket-home">French Guiana</span><span class="ticket-away">St. Vincent and the Grenadines</span></a>',
  "</div></details>",
  '<h2>England <span>1</span></h2><details class="league-group"><summary><a href="/league/2">WSL Cup</a></summary><div>',
  '<a href="/fixture/102-chelsea-w-vs-arsenal-w" class="ticket ticket-finished"><span class="ticket-stub"><b><time datetime="2026-11-18T18:00:00Z">18:00</time></b><small class="ticket-sub">full time</small></span><span class="ticket-body"><span class="ticket-home">Chelsea W</span><span class="ticket-away">Arsenal W</span></span></a>',
  "</div></details>",
  '<h2>Brazil <span>1</span></h2><details class="league-group"><summary><a href="/league/3">Serie A</a></summary><div>',
  '<a href="/fixture/103-home-vs-away" class="ticket ticket-ns"><time datetime="2026-11-18T19:00:00Z">19:00</time><span class="ticket-home">Home</span><span class="ticket-away">Away</span></a>',
  "</div></details></html>",
].join("");

describe("Flashscore European daily fixture parser", () => {
  it("keeps European domestic and UEFA matches, filters other confederations and world friendlies, and converts UTC to Brussels date", () => {
    const feed = [
      "ZA÷ENGLAND: Southern League Premier South¬ZY÷England¬ZL÷/football/england/southern-league-premier-south/¬~",
      "AA÷eng-1¬AD÷1795021200¬AB÷1¬AE÷Home FC¬AF÷Away FC¬~",
      "ZA÷EUROPE: UEFA Champions League Women - League phase¬ZY÷Europe¬ZL÷/football/europe/uefa-champions-league-women/¬~",
      "AA÷uefa-1¬AD÷1794958200¬AB÷2¬AE÷Häcken W¬AF÷Manchester City W¬~",
      "ZA÷WORLD: Friendly International¬ZY÷World¬ZL÷/football/world/friendly-international/¬~",
      "AA÷world-1¬AD÷1795021200¬AB÷1¬AE÷Team A¬AF÷Team B¬~",
      "ZA÷NORTH & CENTRAL AMERICA: CONCACAF Nations League¬ZY÷North & Central America¬ZL÷/football/north-central-america/concacaf-nations-league/¬~",
      "AA÷concacaf-1¬AD÷1795021200¬AB÷1¬AE÷Team C¬AF÷Team D¬~",
      "ZA÷ENGLAND: Premier League¬ZY÷England¬ZL÷/football/england/premier-league/¬~AA÷next-day¬AD÷1795044600¬AB÷1¬AE÷Home 2¬AF÷Away 2¬~",
    ].join("");
    const result = parseFlashscoreFixtures(feed, "2026-11-18");
    expect(result.rawMatches).toBe(5);
    expect(result.fixtures).toHaveLength(2);
    expect(result.fixtures[0]).toMatchObject({
      id: "flashscore|eng-1", competition: "Southern League Premier South", countryCode: "ENG",
      date: "2026-11-18", time: "18:00", home: "Home FC", away: "Away FC", status: "scheduled",
    });
    expect(result.fixtures[1]).toMatchObject({
      id: "flashscore|uefa-1", competition: "UEFA Champions League Women - League phase", countryCode: "UEFA",
      date: "2026-11-18", time: "00:30", home: "Häcken W", away: "Manchester City W", status: "live",
    });
    expect(result.skippedNonEuropean).toBe(2);
    expect(result.skippedWrongDate).toBe(1);
  });
});

describe("FootyNomad fixture parser", () => {
  it("keeps European country fixtures and UEFA world competitions, filters non-European fixtures, and converts UTC to Brussels date", () => {
    const result = parseFootyNomadFixtures(FOOTYNOMAD_SAMPLE, "2026-11-18");
    expect(result.pageMatches).toBe(2);
    expect(result.fixtures).toHaveLength(2);
    expect(result.fixtures[0]).toMatchObject({
      id: "footynomad|101", competition: "UEFA Champions League Women", countryCode: "UEFA",
      date: "2026-11-18", time: "00:30", home: "Häcken W", away: "Manchester City W", source: "FootyNomad",
    });
    expect(result.fixtures[1]).toMatchObject({
      id: "footynomad|102", competition: "WSL Cup", countryCode: "ENG",
      date: "2026-11-18", time: "19:00", status: "finished",
    });
  });

  it("normalizes UEFA country headings with diacritics and alternate official names", () => {
    const cases = [
      { country: "Kazakhstan", code: "KAZ" },
      { country: "Republic of Ireland", code: "IRE" },
      { country: "Türkiye", code: "TUR" },
    ];
    for (const [index, item] of cases.entries()) {
      const html = `<h2>${item.country} <span>1</span></h2><details class="league-group"><summary><a href="/league/6">Premier League</a></summary><a href="/fixture/${110 + index}-home-vs-away" class="ticket ticket-ns"><time datetime="2026-11-18T17:00:00Z">18:00</time><span class="ticket-home">Home FC</span><span class="ticket-away">Away FC</span></a></details>`;
      const result = parseFootyNomadFixtures(html, "2026-11-18");
      expect(result.fixtures).toHaveLength(1);
      expect(result.fixtures[0].countryCode).toBe(item.code);
    }
  });

  it("skips live fixture cards with no exact kickoff timestamp instead of inventing a time", () => {
    const html = '<h2>England 1</h2><details class="league-group"><summary><a href="/league/4">WSL Cup</a></summary><a href="/fixture/104-live-vs-team" class="ticket ticket-live"><small class="ticket-sub">11&#39; live</small><span class="ticket-home">Home W</span><span class="ticket-away">Away W</span></a></details>';
    const result = parseFootyNomadFixtures(html, "2026-11-18");
    expect(result.fixtures).toHaveLength(0);
    expect(result.skippedNoTimestamp).toBe(1);
  });
  it("includes Israeli domestic fixtures in the European country map", () => {
    const html = `<h2>Israel <span>1</span></h2><details class="league-group"><summary><a href="/league/5">Premier League</a></summary><a href="/fixture/105-home-vs-away" class="ticket ticket-ns"><time datetime="2026-11-18T17:00:00Z">19:00</time><span class="ticket-home">Maccabi Haifa</span><span class="ticket-away">Hapoel Be'er Sheva</span></a></details>`;
    const result = parseFootyNomadFixtures(html, "2026-11-18");
    expect(result.fixtures).toHaveLength(1);
    expect(result.fixtures[0]).toMatchObject({ id: "footynomad|105", countryCode: "ISR", competition: "Premier League", date: "2026-11-18", time: "18:00" });
  });
});

describe("FootyNomad daily fixtures Worker proxy", () => {
  it("fetches the two UTC date pages, returns normalized Europe-only fixtures, and caches", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockImplementation(() => Promise.resolve(new Response(FOOTYNOMAD_SAMPLE, { status: 200, headers: { "Content-Type": "text/html" } })));
    vi.stubGlobal("fetch", upstream);
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://moneyball.example/api/footynomad/fixtures/2026-11-18", { headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } }), { ASSETS: { fetch: vi.fn() } }, { waitUntil });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.map(call => call[0])).toEqual([
      "https://footynomad.com/fixtures/2026-11-17",
      "https://footynomad.com/fixtures/2026-11-18",
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("FootyNomad");
    const body = await response.json();
    expect(body.fixtures).toHaveLength(2);
    expect(body.pagesChecked).toBe(2);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("rejects impossible dates before contacting FootyNomad", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/footynomad/fixtures/2026-02-31"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
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
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
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
