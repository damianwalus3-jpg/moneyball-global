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
