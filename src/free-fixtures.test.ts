import { describe, expect, it } from "vitest";
import { fixtureKey, isEuropeanCompetitionFolder, isEuropeanOpenLiga, openLigaCountryCode, openLigaSeasonYears, parseEspnEuropeanFixtures, espnScoreboardDatesForBrusselsDay, parseTimezoneFootballFixtures } from "./free-fixtures";

describe("European fixture source classification", () => {
  it("accepts known European country names and competition prefixes", () => {
    expect(isEuropeanOpenLiga({ leagueId: 1, leagueName: "Cup of Scotland 2026", leagueShortcut: "cup_scot" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 2, leagueName: "Regional league", leagueShortcut: "bl3" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 3, leagueName: "UEFA Conference League", leagueShortcut: "uecl" })).toBe(true);
  });

  it("includes German regional, women's and Austrian competitions by verified OpenLigaDB shortcuts", () => {
    expect(isEuropeanOpenLiga({ leagueId: 10, leagueName: "NOFV Oberliga Nord", leagueShortcut: "nofvon" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 11, leagueName: "Regionalliga Bayern", leagueShortcut: "regio-bayern" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 12, leagueName: "Thüringenliga", leagueShortcut: "thüli-26" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 13, leagueName: "1. Frauen Fußballbundesliga", leagueShortcut: "ffb1" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 14, leagueName: "Eredivisie", leagueShortcut: "ERE" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 15, leagueName: "Admiral Bundesliga Österreich", leagueShortcut: "öbl" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 16, leagueName: "Premier League 2026/2027", leagueShortcut: "pl" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 17, leagueName: "DFB Frauen Supercup", leagueShortcut: "wsc" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 18, leagueName: "LaLiga EA Sports", leagueShortcut: "la1" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 19, leagueName: "Nations League 2026", leagueShortcut: "nla" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 20, leagueName: "DFB U21", leagueShortcut: "u21dfb" })).toBe(true);
    expect(isEuropeanOpenLiga({ leagueId: 24, leagueName: "UEFA Women's Champions League", leagueShortcut: "WCL", sport: { sportName: "Frauenfußball" } })).toBe(true);
  });

  it("does not treat arbitrary la-prefixed feeds as European", () => {
    expect(isEuropeanOpenLiga({ leagueId: 25, leagueName: "Latin American Cup", leagueShortcut: "latam-cup" })).toBe(false);
  });

  it("rejects known OpenLigaDB test and synthetic Bundesliga feeds", () => {
    expect(isEuropeanOpenLiga({ leagueId: 21, leagueName: "Bundesliga", leagueShortcut: "bl1test" })).toBe(false);
    expect(isEuropeanOpenLiga({ leagueId: 22, leagueName: "BLClaude", leagueShortcut: "blclaude" })).toBe(false);
    expect(isEuropeanOpenLiga({ leagueId: 23, leagueName: "BL12026", leagueShortcut: "bl12026" })).toBe(false);
  });

  it("rejects a non-football sport even when the league name looks European", () => {
    expect(isEuropeanOpenLiga({
      leagueId: 4,
      leagueName: "English Premier League",
      leagueShortcut: "epl",
      sport: { sportName: "Basketball" },
    })).toBe(false);
  });

  it("deduplicates source variants while keeping women's and men's fixtures separate", () => {
    expect(fixtureKey("2026-11-17", "FC Zürich", "Bayern München"))
      .toBe(fixtureKey("2026-11-17", "fc zurich", "bayern munchen"));
    expect(fixtureKey("2026-11-17", "Chelsea F.C. Women", "Paris Saint-Germain (Women)", "UEFA Women's Champions League"))
      .toBe(fixtureKey("2026-11-17", "Chelsea", "Paris Saint-Germain", "UEFA Women's Champions League, League Phase"));
    expect(fixtureKey("2026-11-17", "Juventus FC (Women)", "Oud-Heverlee Leuven (Women)", "UEFA Women's Champions League"))
      .toBe(fixtureKey("2026-11-17", "Juventus", "OH Leuven", "UEFA Women's Champions League"));
    expect(fixtureKey("2026-11-17", "Real Madrid (Women)", "Inter Milan (Women)", "UEFA Women's Champions League"))
      .toBe(fixtureKey("2026-11-17", "Real Madrid", "Internazionale", "UEFA Women's Champions League, League Phase"));
    expect(fixtureKey("2026-11-17", "Chelsea", "Paris Saint-Germain", "Premier League"))
      .not.toBe(fixtureKey("2026-11-17", "Chelsea Women", "Paris Saint-Germain Women", "UEFA Women's Champions League"));
    expect(fixtureKey("2026-11-17", "Home FC", "Away FC"))
      .not.toBe(fixtureKey("2026-11-18", "Home FC", "Away FC"));
    expect(fixtureKey("2026-11-18", "Chelsea W", "Paris Saint Germain W", "WSL Cup"))
      .toBe(fixtureKey("2026-11-18", "Chelsea Women", "Paris Saint Germain Women", "WSL Cup"));
    expect(fixtureKey("2026-11-18", "Chelsea W", "Paris Saint Germain W", "WSL Cup"))
      .not.toBe(fixtureKey("2026-11-18", "Chelsea", "Paris Saint Germain", "Premier League"));
  });
});

describe("OpenLigaDB country attribution", () => {
  it("assigns a real European country instead of the generic EU code when identifiable", () => {
    expect(openLigaCountryCode({ leagueId: 1, leagueName: "1. Bundesliga", leagueShortcut: "bl1" })).toBe("GER");
    expect(openLigaCountryCode({ leagueId: 2, leagueName: "League", leagueShortcut: "fr1" })).toBe("FRA");
    expect(openLigaCountryCode({ leagueId: 3, leagueName: "Premier League", leagueShortcut: "pl" })).toBe("ENG");
    expect(openLigaCountryCode({ leagueId: 4, leagueName: "UEFA Conference League", leagueShortcut: "uecl" })).toBe("UEFA");
    expect(openLigaCountryCode({ leagueId: 8, leagueName: "Admiral Bundesliga Österreich", leagueShortcut: "öbl" })).toBe("AUT");
    expect(openLigaCountryCode({ leagueId: 9, leagueName: "Deutschland 2. Bundesliga", leagueShortcut: "de2" })).toBe("GER");
    expect(openLigaCountryCode({ leagueId: 10, leagueName: "NOFV Oberliga Nord", leagueShortcut: "nofvon" })).toBe("GER");
    expect(openLigaCountryCode({ leagueId: 11, leagueName: "DFB-Pokal Frauen", leagueShortcut: "dfbf" })).toBe("GER");
    expect(openLigaCountryCode({ leagueId: 12, leagueName: "Admiral Bundesliga", leagueShortcut: "BLÖ" })).toBe("AUT");
    expect(openLigaCountryCode({ leagueId: 13, leagueName: "Franz-Beckenbauer-Supercup", leagueShortcut: "BLSupercup" })).toBe("GER");
  });

  it("recognizes Israel and smaller European countries by league name", () => {
    expect(openLigaCountryCode({ leagueId: 5, leagueName: "Israel Premier League", leagueShortcut: "ipl" })).toBe("ISR");
    expect(openLigaCountryCode({ leagueId: 6, leagueName: "League of Faroe Islands", leagueShortcut: "unknown" })).toBe("FRO");
    expect(openLigaCountryCode({ leagueId: 7, leagueName: "Kosovo Superliga", leagueShortcut: "unknown" })).toBe("KOS");
  });
});

describe("OpenLigaDB season discovery", () => {
  it("checks the active season and previous season during the European spring", () => {
    expect(openLigaSeasonYears("2027-03-12")).toEqual([2027, 2026]);
  });
  it("checks the current season from July onward", () => {
    expect(openLigaSeasonYears("2026-11-17")).toEqual([2026]);
  });
});

describe("European competition folders", () => {
  it("includes cup, youth and smaller-country folders without category exclusions", () => {
    expect(isEuropeanCompetitionFolder("data/ENG_CUP_FA")).toBe(true);
    expect(isEuropeanCompetitionFolder("data/UEFA_U21_qualifiers")).toBe(true);
    expect(isEuropeanCompetitionFolder("data/SMR_1_campionato")).toBe(true);
    expect(isEuropeanCompetitionFolder("data/LIE_1_league")).toBe(true);
  });
  it("rejects non-European country folders", () => {
    expect(isEuropeanCompetitionFolder("data/BRA_1_serie-a")).toBe(false);
  });
});


describe("OpenLigaDB European country shortcut coverage", () => {
  it("recognizes two-letter European country prefixes used by league feeds", () => {
    for (const shortcut of ["fr1", "nl1", "pt1", "gr1", "ch1", "cz1", "tr1", "at1", "dk1", "se1", "no1", "ro1", "pl1", "hr1", "ua1", "fi1", "hu1", "bg1", "rs1", "sk1", "si1"]) {
      expect(isEuropeanOpenLiga({ leagueId: 100, leagueName: "League", leagueShortcut: shortcut, sport: { sportName: "Fußball" } }), shortcut).toBe(true);
    }
  });

  it("does not admit arbitrary words that merely start with a country prefix", () => {
    expect(isEuropeanOpenLiga({ leagueId: 101, leagueName: "Latin American Cup", leagueShortcut: "latam-cup", sport: { sportName: "Fußball" } })).toBe(false);
    expect(isEuropeanOpenLiga({ leagueId: 102, leagueName: "Franchise Cup", leagueShortcut: "franchise", sport: { sportName: "Fußball" } })).toBe(false);
  });
});


describe("timezone.football supplemental European fixtures", () => {
  it("imports only mapped European competitions on the exact Brussels date and preserves attribution links", () => {
    const fixtures = parseTimezoneFootballFixtures({
      generated: "2026-11-18T02:43:00.263Z",
      matches: [
        { competition: "premier-league", home: "Arsenal", away: "Chelsea", kickoff: "2026-11-18T17:00:00Z", status: "TIMED", url: "https://timezone.football/premier-league/match/arsenal-v-chelsea/" },
        { competition: "bundesliga", home: "Bayern", away: "Köln", kickoff: "2026-11-17T23:30:00Z", status: "TIMED", url: "https://timezone.football/bundesliga/match/bayern-v-koln/" },
        { competition: "nations-league", home: "Denmark", away: "Norway", kickoff: "2026-11-17T19:45:00Z", status: "TIMED", url: "https://timezone.football/nations-league/match/denmark-v-norway/" },
        { competition: "unknown-competition", home: "Home", away: "Away", kickoff: "2026-11-18T17:00:00Z", url: "https://timezone.football/unknown/" },
        { competition: "premier-league", home: "Home", away: "Away", kickoff: "2026-11-18T17:00:00Z", url: "https://example.com/not-attributed/" },
      ],
    }, "2026-11-18");
    expect(fixtures).toHaveLength(3);
    expect(fixtures.find(fixture => fixture.home === "Denmark")).toMatchObject({ countryCode: "UEFA", competition: "UEFA Nations League", leagueShortcut: "nla", leagueSeason: "2026" });
    expect(fixtures[0]).toMatchObject({
      countryCode: "ENG", competition: "England · Premier League", date: "2026-11-18", time: "18:00",
      home: "Arsenal", away: "Chelsea", source: "timezone.football",
      sourceUrl: "https://timezone.football/premier-league/match/arsenal-v-chelsea/",
    });
    expect(fixtures[1]).toMatchObject({ countryCode: "GER", date: "2026-11-18", time: "00:30", home: "Bayern", away: "Köln" });
  });

  it("rejects malformed feed payloads rather than reporting a successful empty source", () => {
    expect(() => parseTimezoneFootballFixtures({ matches: null }, "2026-11-18")).toThrow("nieprawidłowy feed");
  });
});

describe("ESPN European daily fixture fallback", () => {
  it("keeps European venue fixtures and excludes non-European venues", () => {
    const fixtures = parseEspnEuropeanFixtures({ events: [
      { id: 401, date: "2026-11-18T17:45:00Z", competitions: [{
        altGameNote: "UEFA Women's Champions League, League Phase",
        venue: { address: { country: "Sweden" } },
        competitors: [{ homeAway: "home", team: { displayName: "BK Häcken" } }, { homeAway: "away", team: { displayName: "Manchester City" } }],
      }] },
      { id: 402, date: "2026-11-18T23:30:00Z", competitions: [{
        altGameNote: "Brazil Serie A", venue: { address: { country: "Brazil" } },
        competitors: [{ homeAway: "home", team: { displayName: "Coritiba" } }, { homeAway: "away", team: { displayName: "Santos" } }],
      }] },
    ] }, "2026-11-18");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ id: "espn|401", countryCode: "SWE", competition: "UEFA Women's Champions League, League Phase", date: "2026-11-18", time: "18:45", home: "BK Häcken", away: "Manchester City", source: "ESPN" });
  });

  it("recognizes UEFA Nations League events and attaches the OpenLigaDB national-team history key", () => {
    const fixtures = parseEspnEuropeanFixtures({ events: [{
      id: 420, date: "2026-11-17T19:45:00Z", competitions: [{
        altGameNote: "UEFA Nations League", venue: { address: { country: "Denmark" } },
        competitors: [
          { homeAway: "home", team: { displayName: "Denmark" } },
          { homeAway: "away", team: { displayName: "Norway" } },
        ],
      }],
    }] }, "2026-11-17");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ countryCode: "UEFA", competition: "UEFA Nations League", leagueShortcut: "nla", leagueSeason: "2026", home: "Denmark", away: "Norway" });
  });

  it("recognizes UEFA countries with alternate and diacritic venue names", () => {
    const countries = [
      { name: "Israel", code: "ISR" },
      { name: "Kazakhstan", code: "KAZ" },
      { name: "Republic of Ireland", code: "IRE" },
      { name: "Türkiye", code: "TUR" },
    ];
    const fixtures = parseEspnEuropeanFixtures({ events: countries.map((country, index) => ({
      id: 410 + index,
      date: "2026-11-18T17:45:00Z",
      competitions: [{
        altGameNote: "Domestic League",
        venue: { address: { country: country.name } },
        competitors: [
          { homeAway: "home", team: { displayName: "Home FC" } },
          { homeAway: "away", team: { displayName: "Away FC" } },
        ],
      }],
    })) }, "2026-11-18");
    expect(fixtures.map(fixture => fixture.countryCode)).toEqual(countries.map(country => country.code));
  });

  it("uses Brussels date when an event timestamp crosses UTC midnight", () => {
    const fixtures = parseEspnEuropeanFixtures({ events: [{
      id: 403, date: "2026-11-17T23:30:00Z",
      competitions: [{ altGameNote: "Copa del Rey", venue: { address: { country: "Spain" } }, competitors: [
        { homeAway: "home", team: { displayName: "Home FC" } }, { homeAway: "away", team: { displayName: "Away FC" } },
      ] }],
    }] }, "2026-11-18");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].time).toBe("00:30");
  });

  it("rejects malformed scoreboard payloads instead of reporting an empty successful scan", () => {
    expect(() => parseEspnEuropeanFixtures({ events: null }, "2026-11-18")).toThrow("nieprawidłowa odpowiedź");
  });
});


describe("ESPN Brussels-day source window", () => {
  it("checks the prior UTC day as well as the current day to catch after-midnight Brussels kickoffs", () => {
    expect(espnScoreboardDatesForBrusselsDay("2026-11-18")).toEqual(["20261117", "20261118"]);
  });
});
