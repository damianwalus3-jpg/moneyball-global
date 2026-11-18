import { describe, expect, it } from "vitest";
import { buildPitchApiXgForm, isPitchApiCountryEligible, parsePitchApiXgStats, type PitchApiLeagueMatch, type PitchApiTeamMatchStats } from "./pitchapi";

const match: PitchApiLeagueMatch = {
  id: "m_Ab12Cd", time_utc: "2026-11-17T19:00:00Z", status: "finished",
  home: { id: "t_Home01", name: "Home FC" }, away: { id: "t_Away01", name: "Away FC" },
  score_home: 2, score_away: 1,
};
const stats: PitchApiTeamMatchStats = {
  match_id: match.id, home_team: match.home, away_team: match.away,
  periods: [{ period: "All", groups: [
    { items: [
      { key: "expected_goals", home: "1.82", away: "0.74" },
      { key: "total_shots", home: "15", away: "7" },
    ] },
  ] }],
};

describe("PitchAPI xG history parsing", () => {
  it("extracts team-specific xG and shots from the All period", () => {
    expect(parsePitchApiXgStats(stats, "t_Home01", match)).toMatchObject({
      matchId: "m_Ab12Cd", isHome: true, xgFor: 1.82, xgAgainst: 0.74, goalsFor: 2, goalsAgainst: 1, shotsFor: 15, shotsAgainst: 7,
    });
    expect(parsePitchApiXgStats(stats, "t_Away01", match)).toMatchObject({
      isHome: false, xgFor: 0.74, xgAgainst: 1.82, goalsFor: 1, goalsAgainst: 2, shotsFor: 7, shotsAgainst: 15,
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
    }));
    const form = buildPitchApiXgForm("Home FC", observations);
    expect(form.sampleSize).toBe(5);
    expect(form.matches.map(row => row.matchId)).toEqual(["m_0","m_1","m_2","m_3","m_4"]);
    expect(form.xgForPerMatch).toBe(3);
    expect(form.shotsForPerMatch).toBe(13.5);
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
