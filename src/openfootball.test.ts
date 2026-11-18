import { describe, expect, it } from "vitest";
import { findOpenFootballFixtureResult, loadOpenFootballRecentTeamForm, openFootballSeasonFolder, parseOpenFootballFixtures, parseOpenFootballMatches, type OpenFootballFeed } from "./openfootball";
import { vi } from "vitest";

const france: OpenFootballFeed = {
  id: "test-france",
  countryCode: "FRA",
  competition: "France · Ligue 1",
  urlForSeason: season => `https://example.test/${season}.txt`,
  timeZone: "Europe/Paris",
};
const austria: OpenFootballFeed = {
  id: "test-austria",
  countryCode: "AUT",
  competition: "Austria · Bundesliga",
  urlForSeason: season => `https://example.test/${season}.txt`,
  timeZone: "Europe/Vienna",
};

describe("OpenFootball fixtures", () => {
  it("parses v-format fixtures and converts local kickoff to Brussels time", () => {
    const text = `= France Ligue 1\nFri Nov 20 2026\n  20:00 Paris FC v Lille OSC     2-1 (1-0)\nSat Nov 21\n  15:00 Nice v Lyon\n`;
    const fixtures = parseOpenFootballFixtures(text, france, "2026-11-20");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].home).toBe("Paris FC");
    expect(fixtures[0].away).toBe("Lille OSC");
    expect(fixtures[0].time).toBe("20:00");
    expect(fixtures[0].homeGoals).toBe(2);
    expect(fixtures[0].awayGoals).toBe(1);
    expect(fixtures[0].date).toBe("2026-11-20");
  });

  it("parses score-between-teams format used by Austria feeds", () => {
    const text = `= Austria Bundesliga\nFri Nov 20 2026\n  19:30 LASK Linz 3-0 (2-0) Grazer AK\n`;
    const fixtures = parseOpenFootballFixtures(text, austria, "2026-11-20");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].home).toBe("LASK Linz");
    expect(fixtures[0].away).toBe("Grazer AK");
    expect(fixtures[0].homeGoals).toBe(3);
    expect(fixtures[0].awayGoals).toBe(0);
  });

  it("converts UK summer kickoff to Brussels time and calculates season folder", () => {
    const england = { ...france, countryCode: "ENG", timeZone: "Europe/London" };
    const text = `Fri Aug 21 2026\n  20:00 Arsenal FC v Coventry City FC\n`;
    const fixtures = parseOpenFootballFixtures(text, england, "2026-08-21");
    expect(fixtures[0].time).toBe("21:00");
    expect(openFootballSeasonFolder("2026-11-17")).toBe("2026-27");
    expect(openFootballSeasonFolder("2027-03-10")).toBe("2026-27");
  });
});

describe("OpenFootball history and result adapters", () => {
  it("loads recent form and settles a final score from the public feed", async () => {
    const feedText = `= France Ligue 1\nFri Nov 20 2026\n  20:00 Paris FC v Lille OSC     2-1 (1-0)\nSat Nov 21\n  15:00 Paris FC v Nice     1-0 (0-0)\nSun Nov 22\n  17:00 Lyon v Paris FC\n`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => feedText });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    try {
      const form = await loadOpenFootballRecentTeamForm("europe-france-1", "Paris FC", "2026-11-22");
      expect(form.matches).toHaveLength(2);
      expect(form.matches[0].goalsFor).toBe(1);
      expect(form.matches[0].result).toBe("W");
      const result = await findOpenFootballFixtureResult("europe-france-1", "Paris FC", "Lille OSC", "2026-11-20");
      expect(result?.actual).toBe("1");
      expect(result?.homeGoals).toBe(2);
      expect(result?.awayGoals).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not treat unscored fixtures as finished results", () => {
    const text = `Fri Nov 20 2026\n  20:00 Paris FC v Lille OSC\n`;
    const matches = parseOpenFootballMatches(text, france);
    expect(matches[0].homeGoals).toBeNull();
    expect(matches[0].awayGoals).toBeNull();
  });
});

it("uses the historical fixture season when parsing yearless date headings", () => {
  const text = `Fri Feb 27\n  20:00 Paris FC v Lille OSC 1-0\n`;
  const matches = parseOpenFootballMatches(text, france, undefined, "2026-03-01");
  expect(matches[0].date).toBe("2026-02-27");
});


describe("dynamic European OpenFootball catalogue", () => {
  it("discovers current-season country and competition feeds from the repository tree", async () => {
    const { buildEuropeanOpenFootballFeeds } = await import("./openfootball");
    const feeds = buildEuropeanOpenFootballFeeds([
      "france/2026-27_fr1.txt",
      "france/2024-25_fr2.txt",
      "norway/2026_no1.txt",
      "poland/2026-27_pl2.txt",
      "gibraltar/2026-27_gi1.txt",
      "rsssf/belg2025.txt",
      "brazil/2026_br1.txt",
    ], "2026-11-18");
    expect(feeds.map(feed => feed.id)).toHaveLength(4);
    expect(feeds.map(feed => feed.countryCode)).toEqual(["FRA", "NOR", "POL", "GIB"]);
    expect(feeds[0].competition).toContain("FR1");
    expect(feeds[0].urlForSeason("ignored")).toContain("france/2026-27_fr1.txt");
  });

  it("discovers all current-season feeds in separate national repositories", async () => {
    const { buildNationalOpenFootballFeeds } = await import("./openfootball");
    const cases = [
      ["england", ["2026-27/1-premierleague.txt", "2026-27/2-championship.txt", "2025-26/3-league1.txt", "rsssf/eng2025.txt"], "ENG"],
      ["deutschland", ["2026-27/1-bundesliga.txt", "2026-27/4-regionalliga-west.txt", "2025-26/2-bundesliga2.txt"], "GER"],
      ["italy", ["2026-27/1-seriea.txt", "2026-27/2-serieb.txt", "2026-27/3-seriec_a.txt"], "ITA"],
      ["espana", ["2026-27/1-liga.txt", "2026-27/2-liga2.txt"], "ESP"],
      ["belgium", ["2026-27/be1.txt", "2026-27/hainaut/1_Prov.txt", "2026-27/liege/III_Provinciale_A.txt"], "BEL"],
      ["austria", ["2026-27/1-bundesliga.txt", "2026-27/2-liga2.txt"], "AUT"],
    ] as const;
    for (const [repository, paths, countryCode] of cases) {
      const feeds = buildNationalOpenFootballFeeds(repository, [...paths], "2026-11-18");
      expect(feeds.length).toBeGreaterThan(0);
      expect(feeds.every(feed => feed.countryCode === countryCode)).toBe(true);
      expect(feeds.every(feed => feed.urlForSeason("").includes("/" + repository + "/master/2026-27/"))).toBe(true);
    }
    const belgium = buildNationalOpenFootballFeeds("belgium", ["2026-27/hainaut/1_Prov.txt"], "2026-11-18");
    expect(belgium[0].competition).toContain("Hainaut");
  });

  it("discovers calendar-year seasons for Nordic leagues", async () => {
    const { buildEuropeanOpenFootballFeeds } = await import("./openfootball");
    const feeds = buildEuropeanOpenFootballFeeds(["finland/2026_fi1.txt", "finland/2025_fi1.txt"], "2026-07-10");
    expect(feeds).toHaveLength(1);
    expect(feeds[0].countryCode).toBe("FIN");
  });
});
