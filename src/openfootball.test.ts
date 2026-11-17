import { describe, expect, it } from "vitest";
import { openFootballSeasonFolder, parseOpenFootballFixtures, type OpenFootballFeed } from "./openfootball";

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
    expect(fixtures[0].date).toBe("2026-11-20");
  });

  it("parses score-between-teams format used by Austria feeds", () => {
    const text = `= Austria Bundesliga\nFri Nov 20 2026\n  19:30 LASK Linz 3-0 (2-0) Grazer AK\n`;
    const fixtures = parseOpenFootballFixtures(text, austria, "2026-11-20");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].home).toBe("LASK Linz");
    expect(fixtures[0].away).toBe("Grazer AK");
  });

  it("converts UK summer kickoff to Brussels time and calculates season folder", () => {
    const england = { ...france, countryCode: "ENG", timeZone: "Europe/London" };
    const text = `Fri Aug 21 2026\n  20:00 Arsenal FC v Coventry City FC\n`;
    const fixtures = parseOpenFootballFixtures(text, england, "2026-08-21");
    expect(fixtures[0].time).toBe("21:00");
    expect(openFootballSeasonFolder("2026-11-17")).toBe("2026-2027");
    expect(openFootballSeasonFolder("2027-03-10")).toBe("2026-2027");
  });
});
