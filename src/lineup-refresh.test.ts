import { describe, expect, it } from "vitest";
import { brusselsKickoffTimestamp, getPitchApiLineupStatus, isConfirmedPitchApiLineups, isProjectedPitchApiLineups, isWithinLineupRefreshWindow } from "./lineup-refresh";

describe("Brussels lineup refresh window", () => {
  it("converts winter and summer kickoffs using Brussels daylight-saving rules", () => {
    expect(brusselsKickoffTimestamp("2026-11-19", "19:00")).toBe(Date.UTC(2026, 10, 19, 18, 0));
    expect(brusselsKickoffTimestamp("2026-07-19", "19:00")).toBe(Date.UTC(2026, 6, 19, 17, 0));
  });

  it("rejects malformed dates and times", () => {
    expect(brusselsKickoffTimestamp("2026-02-30", "19:00")).toBeNull();
    expect(brusselsKickoffTimestamp("2026-11-19", "25:00")).toBeNull();
    expect(brusselsKickoffTimestamp("2026/11/19", "19:00")).toBeNull();
  });

  it("starts lineup refresh up to six hours before kickoff and never after kickoff", () => {
    const kickoff = Date.UTC(2026, 10, 19, 18, 0);
    expect(isWithinLineupRefreshWindow("2026-11-19", "19:00", kickoff - 360 * 60_000)).toBe(true);
    expect(isWithinLineupRefreshWindow("2026-11-19", "19:00", kickoff - 361 * 60_000)).toBe(false);
    expect(isWithinLineupRefreshWindow("2026-11-19", "19:00", kickoff + 1)).toBe(false);
  });

  it("requires both confirmed flags and exactly eleven starters on each side", () => {
    const side = { confirmed: true, starters: Array.from({ length: 11 }, () => ({})) };
    expect(isConfirmedPitchApiLineups({ home: side, away: side })).toBe(true);
    expect(isConfirmedPitchApiLineups({ home: side, away: { ...side, starters: side.starters.slice(0, 10) } })).toBe(false);
    expect(isConfirmedPitchApiLineups({ home: side, away: { ...side, confirmed: false } })).toBe(false);
    expect(isConfirmedPitchApiLineups(undefined)).toBe(false);
  });
});


describe("projected lineup evidence", () => {
  it("distinguishes a provider projected XI from a confirmed XI and missing data", () => {
    const projectedSide = { confirmed: false, lineup_type: "predicted", starters: Array.from({ length: 11 }, () => ({})) };
    const confirmedSide = { confirmed: true, starters: Array.from({ length: 11 }, () => ({})) };
    expect(isProjectedPitchApiLineups({ home: projectedSide, away: projectedSide })).toBe(true);
    expect(getPitchApiLineupStatus({ home: projectedSide, away: projectedSide })).toBe("LINEUP_PREDICTED");
    expect(getPitchApiLineupStatus({ home: confirmedSide, away: confirmedSide })).toBe("LINEUP_CONFIRMED");
    expect(getPitchApiLineupStatus({ home: projectedSide, away: { confirmed: false, starters: [] } })).toBe("LINEUP_PENDING");
  });
});
