interface Env { ASSETS: { fetch(request: Request): Promise<Response> } }

const OPENLIGA_API = "https://api.openligadb.de";

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const leagues = url.pathname.match(/^\/api\/openligadb\/leagues\/(\d{4})$/);
    const matches = url.pathname.match(/^\/api\/openligadb\/matches\/((?:[a-z0-9._-]|%[0-9a-f]{2})+)\/(\d{4})$/i);
    const teamMatches = url.pathname.match(/^\/api\/openligadb\/team-matches\/((?:[a-z0-9._-]|%[0-9a-f]{2})+)\/(\d{4})\/([^/]+)$/i);

    if (leagues || matches || teamMatches) {
      const upstreamPath = leagues
        ? `/getavailableleagues/${leagues[1]}`
         : teamMatches
          ? `/getmatchdata/${teamMatches[1]}/${teamMatches[2]}/${encodeURIComponent(decodeURIComponent(teamMatches[3]))}`
          : `/getmatchdata/${encodeURIComponent(decodeURIComponent(matches![1]))}/${matches![2]}`;
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const upstream = await fetch(`${OPENLIGA_API}${upstreamPath}`, {
        headers: { Accept: "application/json" },
      });
      const headers = new Headers(upstream.headers);
      headers.set("Cache-Control", matches ? "public, max-age=900" : "public, max-age=28800");
      headers.set("X-MONEYBALL-SOURCE", "OpenLigaDB");
      headers.set("Access-Control-Allow-Origin", url.origin);
      const response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
