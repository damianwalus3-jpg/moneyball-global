import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRecentTeamFormAcrossCountry } from "./team-form";

afterEach(() => vi.unstubAllGlobals());

const csv = `gw,date,time,home,away,ft_home,ft_away,ft_result
1,2026-08-01,15:00,Real Union,Club B,2,0,H
2,2026-08-08,15:00,Club C,Real Unión,1,1,D
3,2026-08-15,15:00,Real Union,Club D,0,1,A
4,2026-08-22,15:00,Club E,Real Union,0,2,A`;

describe("country-wide club history fallback", () => {
  it("finds league form for a cup fixture without a usable competition folder", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/build_summary.json")) return new Response(JSON.stringify({
        generated_utc: "2026-11-18T00:00:00Z",
        leagues: [
          { league: "Spain · La Liga", folder: "data/ESP_1_la-liga", fixtures: 30 },
          { league: "Spain · Segunda", folder: "data/ESP_2_segunda", fixtures: 25 },
          { league: "Portugal · Primeira", folder: "data/POR_1_primeira-liga", fixtures: 20 },
          { league: "Invalid folder", folder: "data/ESP_cup", fixtures: 10 },
        ],
      }), { status: 200 });
      return new Response(csv, { status: 200 });
    }));
    const form = await loadRecentTeamFormAcrossCountry("ESP", "Real Union", "2026-09-01");
    expect(form.matches).toHaveLength(4);
    expect(form.matches[0].date).toBe("2026-08-22");
    expect(form.matches.some(row => row.opponent === "Club C")).toBe(true);
    expect(form.source).toContain("ESP");
  });

  it("refuses UEFA or malformed country identifiers", async () => {
    await expect(loadRecentTeamFormAcrossCountry("UEFA", "Club", "2026-09-01")).rejects.toThrow();
    await expect(loadRecentTeamFormAcrossCountry("../", "Club", "2026-09-01")).rejects.toThrow();
  });
});
