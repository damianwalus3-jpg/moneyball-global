import { describe, expect, it } from "vitest";
import { fixtureKey, isEuropeanCompetitionFolder, isEuropeanOpenLiga, openLigaSeasonYears } from "./free-fixtures";

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

  it("deduplicates source variants using normalized date and team names", () => {
    expect(fixtureKey("2026-11-17", "FC Zürich", "Bayern München"))
      .toBe(fixtureKey("2026-11-17", "fc zurich", "bayern munchen"));
    expect(fixtureKey("2026-11-17", "Home FC", "Away FC"))
      .not.toBe(fixtureKey("2026-11-18", "Home FC", "Away FC"));
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
