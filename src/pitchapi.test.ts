import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPitchApiXgForm, fetchPitchApiXgFormsForFixture, isPitchApiCountryEligible, parsePitchApiXgStats, type PitchApiLeagueMatch, type PitchApiTeamMatchStats } from "./pitchapi";

const match: PitchApiLeagueMatch = {
  id: "m_Ab12Cd", time_utc: "2026-11-17T19:00:00Z", status: "finished",
  home_team: { id: "t_Home01", name: "Home FC" }, away_team: { id: "t_Away01", name: "Away FC" },
  score_home: 2, score_away: 1,
};
const stats: PitchApiTeamMatchStats = {
  match_id: match.id, home_team: match.home_team, away_team: match.away_team,
  periods: [{ period: "All", groups: [
    { items: [
      { key: "expected_goals", home: "1.82", away: "0.74" },
      { key: "total_shots", home: "15", away: "7" },
      { key: "ShotsOnTarget", home: "6", away: "2" },
      { key: "big_chance", home: "3", away: "1" },
      { key: "expected_goals_on_target", home: "1.4", away: "0.6" },
      { key: "expected_goals_non_penalty", home: "1.7", away: "0.7" },
    ] },
  ] }],
};

describe("PitchAPI xG history parsing", () => {
  it("extracts team-specific xG and shots from the All period", () => {
    expect(parsePitchApiXgStats(stats, "t_Home01", match)).toMatchObject({
      matchId: "m_Ab12Cd", isHome: true, xgFor: 1.82, xgAgainst: 0.74, goalsFor: 2, goalsAgainst: 1, shotsFor: 15, shotsAgainst: 7, shotsOnTargetFor: 6, shotsOnTargetAgainst: 2,
      bigChancesFor: 3, bigChancesAgainst: 1, xgOnTargetFor: 1.4, xgOnTargetAgainst: 0.6, xgNonPenaltyFor: 1.7, xgNonPenaltyAgainst: 0.7,
    });
    expect(parsePitchApiXgStats(stats, "t_Away01", match)).toMatchObject({
      isHome: false, xgFor: 0.74, xgAgainst: 1.82, goalsFor: 1, goalsAgainst: 2, shotsFor: 7, shotsAgainst: 15, shotsOnTargetFor: 2, shotsOnTargetAgainst: 6,
      bigChancesFor: 1, bigChancesAgainst: 3, xgOnTargetFor: 0.6, xgOnTargetAgainst: 1.4, xgNonPenaltyFor: 0.7, xgNonPenaltyAgainst: 1.7,
    });
  });
  it("does not turn missing xG, unknown teams or unplayed scores into zero", () => {
    expect(parsePitchApiXgStats({ ...stats, periods: [] }, "t_Home01", match)).toBeNull();
    expect(parsePitchApiXgStats(stats, "t_Unknown", match)).toBeNull();
    expect(parsePitchApiXgStats(stats, "t_Home01", { ...match, status: "not_started", score_home: null, score_away: null })).toBeNull();
  });
  it("builds a recent five-match xG form with null-safe shot averages", () => {
    const observations = Array.from({ length: 6 }, (_, index) => ({
      matchId: "m_" + index, date: `2026-11-${String(17-index).padStart(2,"0")}`, isHome: index % 2 === 0,
      xgFor: 1 + index, xgAgainst: 0.5 + index, goalsFor: 1, goalsAgainst: 0,
      shotsFor: index === 0 ? null : 10 + index, shotsAgainst: 5,
      shotsOnTargetFor: 4, shotsOnTargetAgainst: 2, bigChancesFor: 2, bigChancesAgainst: 1,
      xgOnTargetFor: 1.2, xgOnTargetAgainst: 0.4, xgNonPenaltyFor: 0.9, xgNonPenaltyAgainst: 0.3,
      ppdaFor: 9, fieldTiltFor: 55, boxEntriesFor: 10, xThreatFor: 0.8, xAssistedGoalsFor: 0.6, directSpeedFor: 1.8,
    }));
    const form = buildPitchApiXgForm("Home FC", observations);
    expect(form.sampleSize).toBe(5);
    expect(form.matches.map(row => row.matchId)).toEqual(["m_0","m_1","m_2","m_3","m_4"]);
    expect(form.xgForPerMatch).toBe(3);
    expect(form.shotsForPerMatch).toBe(12.5);
    expect(form.shotsOnTargetForPerMatch).toBe(4);
    expect(form.bigChancesForPerMatch).toBe(2);
    expect(form.xgOnTargetForPerMatch).toBeCloseTo(1.2, 8);
    expect(form.source).toBe("PitchAPI");
  });
  it("fails closed for unknown and non-European country codes", () => {
    expect(isPitchApiCountryEligible("BEL")).toBe(true);
    expect(isPitchApiCountryEligible("UEFA")).toBe(true);
    expect(isPitchApiCountryEligible("SAU")).toBe(false);
    expect(isPitchApiCountryEligible("UAE")).toBe(false);
    expect(isPitchApiCountryEligible(null)).toBe(false);
  });
});

describe("PitchAPI historical xG fetch", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reads the documented league envelope and aggregates only prior finished matches", async () => {
    const homeId = "t_Home01", awayId = "t_Away01";
    const rows: PitchApiLeagueMatch[] = [
      ...[17,15,13].map((day,index) => ({
        id: "m_Home" + index, time_utc: `2026-11-${day}T18:00:00Z`, status: "finished",
        home_team: { id: homeId, name: "Home FC" }, away_team: { id: "t_OppH" + index, name: "Opponent H" },
        score_home: 2, score_away: 0,
      })),
      ...[16,14,12].map((day,index) => ({
        id: "m_Away" + index, time_utc: `2026-11-${day}T18:00:00Z`, status: "finished",
        home_team: { id: "t_OppA" + index, name: "Opponent A" }, away_team: { id: awayId, name: "Away FC" },
        score_home: 0, score_away: 1,
      })),
      { id: "m_Future", time_utc: "2026-11-19T18:00:00Z", status: "finished",
        home_team: { id: homeId, name: "Home FC" }, away_team: { id: awayId, name: "Away FC" }, score_home: 9, score_away: 9 },
      { id: "m_Unsettled", time_utc: "2026-11-11T18:00:00Z", status: "not_started",
        home_team: { id: homeId, name: "Home FC" }, away_team: { id: awayId, name: "Away FC" }, score_home: null, score_away: null },
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/leagues/")) return new Response(JSON.stringify({ data: { league: { id: "l_Ab12Cd", season: "2026/2027" }, matches: rows } }), { status: 200 });
      const id = url.split("/").at(-2) ?? "";
      const isHome = id.startsWith("m_Home");
      const h = isHome ? homeId : "t_Opp";
      const a = isHome ? "t_Opp" : awayId;
      return new Response(JSON.stringify({ data: {
        match_id: id, home_team: { id: h, name: "Home" }, away_team: { id: a, name: "Away" },
        periods: [{ period: "All", groups: [{ items: [
          { key: "expected_goals", home: isHome ? "1.8" : "0.6", away: isHome ? "0.4" : "1.4" },
          { key: "total_shots", home: "12", away: "8" },
          { key: "ShotsOnTarget", home: "5", away: "3" },
          { key: "big_chance", home: "2", away: "1" },
          { key: "expected_goals_on_target", home: "1.2", away: "0.5" },
        ] }] }],
      } }), { status: 200 });
    }));
    const forms = await fetchPitchApiXgFormsForFixture({ leagueId: "l_Ab12Cd", season: "2026/2027", homeTeamId: homeId, awayTeamId: awayId, beforeDate: "2026-11-18" });
    expect(forms.home.sampleSize).toBe(3);
    expect(forms.away.sampleSize).toBe(3);
    expect(forms.home.xgForPerMatch).toBeCloseTo(1.8, 8);
    expect(forms.away.xgForPerMatch).toBeCloseTo(1.4, 8);
    expect(forms.home.shotsOnTargetForPerMatch).toBe(5);
    expect(forms.away.bigChancesForPerMatch).toBe(1);
  });
});
