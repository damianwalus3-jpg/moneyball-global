import { describe, expect, it } from "vitest";
import { brusselsKickoffTimestamp, isConfirmedPitchApiLineups, isWithinLineupRefreshWindow } from "./lineup-refresh";

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

  it("refreshes only within 70 minutes before kickoff and never after kickoff", () => {
    const kickoff = Date.UTC(2026, 10, 19, 18, 0);
    expect(isWithinLineupRefreshWindow("2026-11-19", "19:00", kickoff - 70 * 60_000)).toBe(true);
    expect(isWithinLineupRefreshWindow("2026-11-19", "19:00", kickoff - 71 * 60_000)).toBe(false);
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
