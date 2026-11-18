import { describe, expect, it, vi, afterEach } from "vitest";
import { loadRecentTeamForm, mapEspnTeamForm, mapOpenLigaTeamForm, mergeVerifiedTeamForms, type TeamForm } from "./team-form";

const csv = `gw,date,time,home,away,ft_home,ft_away,ft_result
1,2026-08-01,15:00,Club A,Club B,2,0,H
2,2026-08-08,15:00,Club C,Club A,1,1,D
3,2026-08-15,15:00,Club A,Club D,0,1,A
4,2026-08-22,15:00,Club E,Club A,0,2,A
5,2026-08-29,15:00,Club A,Club F,3,1,H
6,2026-09-05,15:00,Club G,Club A,1,0,H
7,2026-09-12,15:00,Club A,Club H,2,2,D`;
afterEach(() => { vi.unstubAllGlobals(); });

describe("historical team form", () => {
  it("returns five most recent completed matches before fixture date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ generated_utc: "2026-11-17T00:00:00Z" }),
      text: async () => csv,
      status: 200,
    })));
    const form = await loadRecentTeamForm("BEL_1_pro-league", "Club A", "2026-09-10");
    expect(form.matches).toHaveLength(6);
    expect(form.matches[0].date).toBe("2026-09-05");
    expect(form.matches[0].result).toBe("L");
    expect(form.matches.every(match => match.date < "2026-09-10")).toBe(true);
  });
  it("separates home and away form and calculates points", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ generated_utc: "2026-11-17T00:00:00Z" }),
      text: async () => csv,
      status: 200,
    })));
    const form = await loadRecentTeamForm("BEL_1_pro-league", "Club A", "2026-09-10");
    expect(form.home.every(match => match.venue === "H")).toBe(true);
    expect(form.away.every(match => match.venue === "A")).toBe(true);
    expect(form.matches.find(match => match.result === "W")?.points).toBe(3);
  });
  it("rejects invalid league folder identifiers", async () => {
    await expect(loadRecentTeamForm("../etc", "Club A", "2026-09-10")).rejects.toThrow();
  });
});


describe("OpenLigaDB historical team form", () => {
  it("retains up to fifteen rows for cross-source merging", () => {
    const matches = Array.from({ length: 9 }, (_, index) => ({
      matchDateTimeUTC: `2026-09-${String(9 - index).padStart(2, "0")}T15:00:00Z`,
      matchIsFinished: true,
      team1: { teamName: "Club A" },
      team2: { teamName: `Opponent ${index}` },
      matchResults: [{ resultTypeID: 2, pointsTeam1: 1, pointsTeam2: 0 }],
    }));
    const form = mapOpenLigaTeamForm(matches, "Club A", "2026-09-10");
    expect(form.matches).toHaveLength(9);
    expect(form.matches[0].date).toBe("2026-09-09");
  });
});

describe("ESPN team history fallback", () => {
  it("maps only finished matches before the target date and calculates form", () => {
    const form = mapEspnTeamForm({ team: "France", generatedAt: "2026-11-18T07:19:13Z", matches: [
      { date: "2026-11-15", opponent: "Türkiye", venue: "H", goalsFor: 2, goalsAgainst: 1 },
      { date: "2026-11-10", opponent: "Spain", venue: "A", goalsFor: 0, goalsAgainst: 0 },
      { date: "2026-11-05", opponent: "Italy", venue: "H", goalsFor: 1, goalsAgainst: 2 },
      { date: "2026-11-20", opponent: "Future", venue: "H", goalsFor: 9, goalsAgainst: 0 },
      { date: "2026-11-01", opponent: "Bad", venue: "A", goalsFor: -1, goalsAgainst: 0 },
    ] }, "France", "2026-11-18");
    expect(form.matches).toHaveLength(3);
    expect(form.matches[0]).toMatchObject({ opponent: "Türkiye", result: "W", points: 3 });
    expect(form.home).toHaveLength(2);
    expect(form.away).toHaveLength(1);
    expect(form.source).toContain("ESPN");
  });

  it("rejects malformed ESPN payloads", () => {
    expect(() => mapEspnTeamForm({ matches: "bad" }, "France", "2026-11-18")).toThrow(/nieprawidłowa/);
  });
});

describe("multi-source historical form merge", () => {
  const form = (source: string, rows: TeamForm["matches"]): TeamForm => ({
    team: "Club A", matches: rows, home: rows.filter(row => row.venue === "H"), away: rows.filter(row => row.venue === "A"),
    source, sourceUpdatedAt: "2026-11-18T00:00:00Z",
  });
  const row = (date: string, opponent: string, venue: "H" | "A", goalsFor: number, goalsAgainst: number) => ({
    date, opponent, venue, goalsFor, goalsAgainst,
    result: goalsFor > goalsAgainst ? "W" as const : goalsFor === goalsAgainst ? "D" as const : "L" as const,
    points: goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0,
  });
  it("combines independent sources and collapses exact duplicates", () => {
    const merged = mergeVerifiedTeamForms([
      form("open-matchday", [row("2026-09-10","Club B","H",2,0), row("2026-09-03","Club C","A",1,1)]),
      form("OpenLigaDB", [row("2026-09-10","Club B","H",2,0), row("2026-08-27","Club D","H",0,1)]),
      form("ESPN", [row("2026-08-20","Club E","A",3,1)]),
    ], "Club A");
    expect(merged.matches).toHaveLength(4);
    expect(merged.source).toContain("open-matchday");
    expect(merged.source).toContain("ESPN");
  });
  it("rejects conflicting scores for the same fixture rather than choosing one", () => {
    const merged = mergeVerifiedTeamForms([
      form("source A", [row("2026-09-10","Club B","H",2,0)]),
      form("source B", [row("2026-09-10","Club B","H",1,0)]),
    ], "Club A");
    expect(merged.matches).toHaveLength(0);
  });
});
