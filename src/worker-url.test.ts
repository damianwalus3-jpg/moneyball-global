import { describe, expect, it } from "vitest";
import { resolveWorkerFetchUrl } from "./worker-url";

describe("worker-relative source URL resolution", () => {
  it("resolves relative API paths against the Rebuilt production Worker", () => {
    expect(resolveWorkerFetchUrl("/api/footynomad/fixtures/2026-11-19", "https://moneyball-global-rebuild.damianwalus3.workers.dev"))
      .toBe("https://moneyball-global-rebuild.damianwalus3.workers.dev/api/footynomad/fixtures/2026-11-19");
  });
  it("preserves absolute third-party source URLs", () => {
    expect(resolveWorkerFetchUrl("https://example.com/fixtures", "https://moneyball-global-rebuild.damianwalus3.workers.dev"))
      .toBe("https://example.com/fixtures");
  });
});
