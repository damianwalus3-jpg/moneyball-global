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

  it("reports sanitized provider quota and bookmaker metadata without exposing secrets", async () => {
    const secret = "do-not-return-this";
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const account = {
      subscriptions: [{
        is_active: true, request_limit: 250, request_count: 37,
        valid_until: "2026-12-31T00:00:00.000Z",
        bookmakers: { "bwin.be": {}, "unibet.be": {} },
      }],
    };
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify(account), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/status"), {
      ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: secret, STRIKERAPI_API_KEY: secret, ODDS_PILOT_TOKEN: "pilot-secret-0123456789-abcdef-extra",
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(body).toContain('"oddspapi":true');
    expect(body).toContain('"strikerapi":true');
    expect(body).toContain('"pilotEnabled":true');
    expect(body).toContain('"requestLimit":250');
    expect(body).toContain('"requestCount":37');
    expect(body).toContain('"remaining":213');
    expect(body).toContain('"bwin.be"');
    expect(body).toContain('"unibet.be"');
    expect(body).not.toContain(secret);
    expect(body).not.toContain("pilot-secret");
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });


  it("fetches a Brussels-day OddsPapi batch with only two billable calls and maps real Bwin prices", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const account = { subscriptions: [{ is_active: true, request_limit: 250, request_count: 0,
      bookmakers: { "bwin.be": {}, "unibet.be": {} } }] };
    const fixtures = [{ fixtureId: "op-1", tournamentId: 77, startTime: "2026-11-19T18:00:00.000Z",
      participant1Name: "Club Brugge FC", participant2Name: "KAA Gent", hasOdds: true, updatedAt: "2026-11-19T09:00:00.000Z" }];
    const price = (value: number) => ({ active: true, price: value, changedAt: "2026-11-19T10:00:00.000Z" });
    const odds = { fixtureId: "op-1", bookmakerOdds: { "bwin.be": {
      bookmakerIsActive: true, suspended: false, fixturePath: "https://sports.bwin.be/event",
      markets: { "101": { marketActive: true, outcomes: {
        "101": { players: { "0": price(2.1) } },
        "102": { players: { "0": price(3.2) } },
        "103": { players: { "0": price(3.5) } },
      } } },
    } } };
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(account), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixtures), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(odds), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const token = "pilot-secret-0123456789-abcdef-extra";
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/oddspapi/daily", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-11-19", slot: "morning", fixtures: [
        { id: "local-1", date: "2026-11-19", time: "19:00", home: "Club Brugge", away: "KAA Gent" },
      ] }),
    }), { ASSETS: { fetch: vi.fn() }, ODDSPAPI_API_KEY: "provider-secret", ODDS_PILOT_TOKEN: token }, { waitUntil: vi.fn() });
    const body = await response.json() as { status: string; estimatedRequestsUsed: number; quotes: Array<{ fixtureId: string; bookmaker: string; odds1: number; oddsX: number; odds2: number; complete1X2: boolean }> };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", estimatedRequestsUsed: 2 });
    expect(body.quotes).toEqual([expect.objectContaining({
      fixtureId: "local-1", bookmaker: "Bwin Belgium", odds1: 2.1, oddsX: 3.2, odds2: 3.5, complete1X2: true,
    })]);
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(String(upstream.mock.calls[1][0])).toContain("/v4/fixtures?");
    expect(String(upstream.mock.calls[2][0])).toContain("/v4/odds-by-tournaments?");
    expect(String(upstream.mock.calls[2][0])).toContain("tournamentIds=77");
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
    expect(await response.json()).toEqual({ error: "fixtureId, apiFootballFixtureId, strikerGameId or strikerDate is required" });
  });

  it("rejects malformed API-Football fixture identifiers before provider access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?apiFootballFixtureId=../../etc", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), { ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-key-value", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef" }, { waitUntil: vi.fn() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_fixture_identifier" });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("returns a sanitized StrikerAPI 4xx diagnostic without exposing secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid date parameter" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerDate=2026-11-18", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), {
      ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "private-provider-key",
      ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
    }, { waitUntil: vi.fn() });
    const body = await response.text();
    expect(body).toContain("upstream_http_400: Invalid date parameter");
    expect(body).not.toContain("private-provider-key");
    expect(body).not.toContain("test-pilot-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes StrikerAPI moneyline prices to decimal odds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { games: [{
      game_id: "game-1", starts_at: "2026-11-18T18:00:00Z",
      home: { name: "Home FC" }, away: { name: "Away FC" },
      books: [{ provider: "ExampleBook", source: "live", captured_at: "2026-11-17T18:00:00Z", home_ml_close: 100, draw_ml_close: -110, away_ml_close: 250, home_handicap_open: -0.25, home_handicap_close: -0.5, handicap_home_odds: -105, handicap_away_odds: -115, total_open: 2.25, total_close: 2.5, over_odds: -108, under_odds: 100 }],
    }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?strikerGameId=game-1", { headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" } }), {
      ASSETS: { fetch: vi.fn() }, STRIKERAPI_API_KEY: "private-key-value", ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
    }, { waitUntil: vi.fn() });
    const body = await response.json() as { results: { strikerapi: { games: Array<{ bookmakers: Array<{ odds1: number; oddsX: number; odds2: number; homeHandicapClose: number | null; handicapHomeOdds: number | null; handicapAwayOdds: number | null; totalClose: number | null; overOdds: number | null; underOdds: number | null; complete1X2: boolean }> }> } } };
    const book = body.results.strikerapi.games[0].bookmakers[0];
    expect(book.odds1).toBe(2);
    expect(book.oddsX).toBe(1.9091);
    expect(book.odds2).toBe(3.5);
    expect(book.complete1X2).toBe(true);
    expect(book.homeHandicapClose).toBe(-0.5);
    expect(book.handicapHomeOdds).toBeCloseTo(1.9524, 4);
    expect(book.handicapAwayOdds).toBeCloseTo(1.8696, 4);
    expect(book.totalClose).toBe(2.5);
    expect(book.overOdds).toBeCloseTo(1.9259, 4);
    expect(book.underOdds).toBe(2);
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


describe("PitchAPI secure Worker proxy", () => {
  const env = (key?: string) => ({ ASSETS: { fetch: vi.fn() }, ...(key ? { PITCHAPI_API_KEY: key } : {}) });
  it("does not call PitchAPI when the server secret is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/date/2026-11-18"), env(), { waitUntil: vi.fn() });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "pitchapi_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("validates date and status before making upstream requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const invalidDate = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/date/2026-02-31"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    const invalidStatus = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/date/2026-11-18?status=maybe"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    expect(invalidDate.status).toBe(400);
    expect(invalidStatus.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("forwards only allowlisted read-only routes with the secret header and caches non-live responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { match_id: "m_Ab12Cd" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/matches/m_Ab12Cd/lineups", { headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" } }), env("pk_test_12345678901234567890"), { waitUntil });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pitchapi.dev/v1/matches/m_Ab12Cd/lineups");
    expect(fetchMock.mock.calls[0][1].headers["X-API-KEY"]).toBe("pk_test_12345678901234567890");
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("PitchAPI");
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
  it("rejects unknown routes and external origins without leaking the key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const assetsFetch = vi.fn().mockResolvedValue(new Response("app asset", { status: 200 }));
    const invalid = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/matches/m_Ab12Cd/admin"), { ASSETS: { fetch: assetsFetch }, PITCHAPI_API_KEY: "pk_test_12345678901234567890" }, { waitUntil: vi.fn() });
    const forbidden = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/date/2026-11-18", { headers: { Origin: "https://attacker.example" } }), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    expect(invalid.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(forbidden.status).toBe(403);
    expect(JSON.stringify(await forbidden.json())).not.toContain("pk_test_");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("proxies the PitchAPI league catalogue through the server-side secret", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { leagues: [{ id: "l_Ab12Cd", country_code: "BEL", seasons: ["2026/2027"] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues"), env("pk_test_12345678901234567890"), { waitUntil });
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pitchapi.dev/v1/leagues");
    expect(fetchMock.mock.calls[0][1].headers["X-API-KEY"]).toBe("pk_test_12345678901234567890");
    expect(response.headers.get("X-MONEYBALL-SOURCE")).toBe("PitchAPI");
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
  it("proxies PitchAPI league metadata and historical match lists with validated query parameters", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { id: "l_Ab12Cd", country_code: "BEL" } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);
    const waitUntil = vi.fn();
    const metadata = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd"), env("pk_test_12345678901234567890"), { waitUntil });
    const history = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd/matches?season=2026%2F2027&status=played"), env("pk_test_12345678901234567890"), { waitUntil });
    expect(metadata.status).toBe(200);
    expect(history.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pitchapi.dev/v1/leagues/l_Ab12Cd");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.pitchapi.dev/v1/leagues/l_Ab12Cd/matches?season=2026%2F2027&status=played");
    expect(fetchMock.mock.calls[0][1].headers["X-API-KEY"]).toBe("pk_test_12345678901234567890");
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });
  it("caches upcoming league schedules for ten minutes but keeps played history cached for six hours", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { matches: [] } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const upcoming = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd/matches?season=2026%2F2027&status=upcoming"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    const played = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd/matches?season=2026%2F2027&status=played"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    expect(upcoming.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(played.headers.get("Cache-Control")).toBe("public, max-age=21600");
  });
  it("rejects malformed PitchAPI league history parameters before provider calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const invalidSeason = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd/matches?season=bad"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    const invalidStatus = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/leagues/l_Ab12Cd/matches?status=live"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    expect(invalidSeason.status).toBe(400);
    expect(invalidStatus.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not cache live snapshots", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { live: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/pitchapi/matches/m_Ab12Cd/live"), env("pk_test_12345678901234567890"), { waitUntil: vi.fn() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(cache.put).not.toHaveBeenCalled();
  });
});


describe("API-Football Pro secure status proxy", () => {
  const env = { ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "server-only-test-secret" };
  it("exposes subscription and rate-limit metadata but never account personal data or the key", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: {
        account: { firstname: "Private", email: "private@example.com" },
        subscription: { plan: "Pro", active: true, end: "2027-01-01T00:00:00Z" },
        requests: { current: 12, limit_day: 7500 },
      },
    }), { status: 200, headers: { "X-RateLimit-Limit": "300", "X-RateLimit-Remaining": "299", "x-ratelimit-requests-remaining": "7488" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/status", {
      headers: { Origin: "https://moneyball-global-rebuild.damianwalus3.workers.dev" },
    }), env, { waitUntil: vi.fn() });
    const body = await response.json() as Record<string, any>;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(body.subscription).toMatchObject({ plan: "Pro", active: true });
    expect(body.requests).toMatchObject({ perMinuteLimit: "300", perMinuteRemaining: "299", dailyRemaining: "7488" });
    expect(JSON.stringify(body)).not.toContain("private@example.com");
    expect(JSON.stringify(body)).not.toContain("Private");
    expect(JSON.stringify(body)).not.toContain("server-only-test-secret");
    expect(fetchMock.mock.calls[0][0]).toBe("https://v3.football.api-sports.io/status");
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("bypasses cached quota metadata when fresh=1 is requested but still checks provider cooldown", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: { subscription: { plan: "Pro", active: true }, requests: { current: 13, limit_day: 7500 } },
    }), { status: 200, headers: { "X-RateLimit-Remaining": "298" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/status?fresh=1"), env, { waitUntil: vi.fn() });
    expect(response.status).toBe(200);
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(cache.match.mock.calls[0][0].url).toContain("/api/api-football/_provider-cooldown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });


  it("normalizes and caches an HTTP 429 provider cooldown from the status endpoint", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { rateLimit: "Too many requests per minute" }, response: {},
    }), { status: 429, headers: { "Retry-After": "17" } })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/status?fresh=1"), env, { waitUntil: vi.fn() });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=17");
    await expect(response.json()).resolves.toMatchObject({ error: "api_football_rate_limited", retryAfterSeconds: 17 });
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("does not call the provider when the secret is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/status"), { ASSETS: { fetch: vi.fn() } }, { waitUntil: vi.fn() });
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe("API-Football Pro batch enrichment", () => {
  const env = { ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "test-api-football-secret" };

  it("fetches up to 20 fixture IDs in one request and caches the complete fixture payload", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const payload = { results: 1, response: [{ fixture: { id: 123 }, events: [], lineups: [], statistics: [], players: [] }] };
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "X-RateLimit-Remaining": "50" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/enrichment?ids=123-456"), env, { waitUntil: vi.fn() });
    expect(upstream).toHaveBeenCalledWith("https://v3.football.api-sports.io/fixtures?ids=123-456&timezone=Europe%2FBrussels", expect.objectContaining({ headers: expect.objectContaining({ "x-apisports-key": "test-api-football-secret" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=900");
    await expect(response.json()).resolves.toMatchObject({ provider: "API-Football Pro", requestedFixtureIds: ["123","456"], fixtures: payload.response, includes: ["events","lineups","fixture_statistics","player_statistics"] });
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("rejects empty, nonnumeric and over-20 fixture ID batches before contacting the provider", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    for (const ids of ["", "abc-123", Array.from({ length: 21 }, (_,i) => String(i + 1)).join("-")]) {
      const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/enrichment?ids=" + ids), env, { waitUntil: vi.fn() });
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("surfaces provider rate limiting as HTTP 429 and caches a shared cooldown", async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: Request) => entries.get(key.url)?.clone()),
      put: vi.fn(async (key: Request, response: Response) => { entries.set(key.url, response.clone()); }),
    };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { rateLimit: "Too many requests. Exceeded requests per minute." }, response: [] }), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/enrichment?ids=123"), env, { waitUntil: vi.fn() });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "api_football_rate_limited", retryAfterSeconds: 60 });
    expect(cache.put).toHaveBeenCalledTimes(1);

    const secondEndpoint = await worker.fetch(new Request("https://moneyball.example/api/api-football/fixtures/2026-11-19"), env, { waitUntil: vi.fn() });
    expect(secondEndpoint.status).toBe(429);
    await expect(secondEndpoint.json()).resolves.toMatchObject({ error: "api_football_rate_limited", retryAfterSeconds: 60 });
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe("API-Football Pro injury batch", () => {
  const env = { ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "test-api-football-secret" };
  it("fetches injury/suspension records for up to 20 fixture IDs and caches successful responses", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    const payload = { results: 1, response: [{ player: { name: "Player" }, type: "Missing Fixture", reason: "Suspended" }] };
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/injuries?ids=123-456"), env, { waitUntil: vi.fn() });
    expect(upstream).toHaveBeenCalledWith("https://v3.football.api-sports.io/injuries?ids=123-456&timezone=Europe%2FBrussels", expect.any(Object));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ provider: "API-Football Pro", requestedFixtureIds: ["123","456"], injuries: payload.response });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
});


describe("API-Football Pro daily feed and odds ID validation", () => {
  it("caches a rate-limited daily fixture feed as a shared provider cooldown", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { rateLimit: "Too many requests. Exceeded requests per minute." }, response: [],
    }), { status: 200 })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/fixtures/2026-11-19"), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
    }, { waitUntil: vi.fn() });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "api_football_rate_limited" });
    expect(cache.put).toHaveBeenCalledTimes(1);
  });


  it("does not misclassify an empty rateLimit field as a provider throttle", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { rateLimit: null }, results: 0, response: [],
    }), { status: 200 })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/fixtures/2026-11-19"), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
    }, { waitUntil: vi.fn() });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ provider: "API-Football Pro", results: 0, fixtures: [] });
    expect(cache.put).toHaveBeenCalledTimes(1);
  });


  it("normalizes and caches an HTTP 429 from the daily fixtures endpoint", async () => {
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { rateLimit: "Too many requests per minute" }, response: [], results: 0,
    }), { status: 429, headers: { "Retry-After": "12" } })));
    const response = await worker.fetch(new Request("https://moneyball.example/api/api-football/fixtures/2026-11-19"), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
    }, { waitUntil: vi.fn() });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    await expect(response.json()).resolves.toMatchObject({ error: "api_football_rate_limited", retryAfterSeconds: 12 });
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("shares an API-Football odds rate limit with the fixtures, enrichment and injury routes", async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: Request) => entries.get(key.url)?.clone()),
      put: vi.fn(async (key: Request, response: Response) => { entries.set(key.url, response.clone()); }),
    };
    vi.stubGlobal("caches", { default: cache });
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: { rateLimit: "Too many requests per minute" }, response: [],
    }), { status: 429, headers: { "Retry-After": "23" } }));
    vi.stubGlobal("fetch", upstream);
    const odds = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?apiFootballFixtureId=123", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
      ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
    }, { waitUntil: vi.fn() });
    expect(odds.status).toBe(200);
    await expect(odds.json()).resolves.toMatchObject({ results: { apiFootball: { error: "api_football_rate_limited", retryAfterSeconds: 23 } } });

    const fixtures = await worker.fetch(new Request("https://moneyball.example/api/api-football/fixtures/2026-11-19"), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
    }, { waitUntil: vi.fn() });
    expect(fixtures.status).toBe(429);
    expect(fixtures.headers.get("Retry-After")).toBe("23");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("accepts a numeric API-Football fixture ID for the odds endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: [{ bookmakers: [] }], results: 1 }), { status: 200 }));
    vi.stubGlobal("caches", { default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() } });
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://moneyball.example/api/odds/pilot?apiFootballFixtureId=123", {
      headers: { Authorization: "Bearer test-pilot-token-0123456789-abcdef" },
    }), {
      ASSETS: { fetch: vi.fn() }, API_FOOTBALL_KEY: "private-api-football-key",
      ODDS_PILOT_TOKEN: "test-pilot-token-0123456789-abcdef",
    }, { waitUntil: vi.fn() });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toContain("/odds?fixture=123");
  });
});
