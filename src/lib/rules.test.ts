import { describe, expect, it } from "vitest";
import { validatePublicKey } from "./config";
import { COLUMNS, OWNER_COLUMN } from "./schema";
import { parseScanRows } from "./scan-import";
import { brusselsInputToISO, isoToBrusselsInput } from "./time";

const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.y`;

describe("key safety", () => {
  it("rejects secret and service_role keys", () => {
    expect(validatePublicKey("sb_secret_abcdefghijklmnop").ok).toBe(false);
    expect(validatePublicKey(jwt({ role: "service_role", ref: "gzgeklcukrclgwbsmbsp" })).ok).toBe(false);
  });
  it("accepts publishable and anon keys for this project", () => {
    expect(validatePublicKey("sb_publishable_abcdefghijklmnop").ok).toBe(true);
    expect(validatePublicKey(jwt({ role: "anon", ref: "gzgeklcukrclgwbsmbsp" })).ok).toBe(true);
    expect(validatePublicKey(jwt({ role: "anon", ref: "otherproject" })).ok).toBe(false);
  });
});

describe("canonical schema contract", () => {
  it("uses owner_id and only canonical columns", () => {
    expect(OWNER_COLUMN).toBe("owner_id");
    expect(COLUMNS.matches).toContain("competition");
    expect(COLUMNS.matches).not.toContain("league");
    expect(COLUMNS.predictions).toContain("market");
    expect(COLUMNS.predictions).not.toContain("prediction_type");
    expect(COLUMNS.predictions).not.toContain("pick");
    expect(COLUMNS.coupon_legs).toContain("prediction_id");
    expect(COLUMNS.coupon_legs).not.toContain("match_id");
    expect(COLUMNS.odds_snapshots).toContain("prediction_id");
    expect(COLUMNS.bankroll_transactions).toContain("transaction_type");
  });
});

describe("Europe/Brussels time", () => {
  it("converts summer (CEST) and winter (CET) wall times", () => {
    expect(brusselsInputToISO("2026-07-01T20:00")).toBe("2026-07-01T18:00:00.000Z");
    expect(brusselsInputToISO("2026-01-15T20:00")).toBe("2026-01-15T19:00:00.000Z");
    expect(isoToBrusselsInput("2026-01-15T19:00:00.000Z")).toBe("2026-01-15T20:00");
  });
});

describe("canonical scan import", () => {
  it("keeps weak predictions as ODRZUCONY and separates 1X2 from Double Chance", () => {
    const result = parseScanRows([
      { kickoff_at: "2026-11-14 20:45", competition: "League 1", country: "Belgium", gender: "men", home_team: "A", away_team: "B", market: "1X2", selection: "1", probability: "60" },
      { kickoff_at: "2026-11-14 20:45", competition: "League 1", country: "Belgium", gender: "men", home_team: "A", away_team: "B", market: "DOUBLE_CHANCE", selection: "1X", probability: "82%" },
      { kickoff_at: "2026-11-15 18:00", competition: "League 2", gender: "women", home_team: "C", away_team: "D" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.matches).toHaveLength(2);
    expect(result.predictions.map((prediction) => prediction.verdict)).toEqual(["ODRZUCONY", "WYBRANY"]);
    expect(result.predictions[1]?.market).toBe("DOUBLE_CHANCE");
    expect(result.predictions[1]?.selection).toBe("1X");
  });
  it("rejects legacy column names instead of silently treating them as canonical", () => {
    const result = parseScanRows([
      { kickoff: "2026-11-14 20:45", league: "L1", home_team: "A", away_team: "B", prediction_type: "1X2", pick: "1", probability: "82" },
    ]);
    expect(result.errors).toHaveLength(1);
  });
  it("reports malformed kickoff and invalid selection", () => {
    expect(parseScanRows([{ kickoff_at: "", home_team: "A", away_team: "B" }]).errors).toHaveLength(1);
    expect(parseScanRows([{ kickoff_at: "2026-11-14 20:45", home_team: "A", away_team: "B", market: "1X2", selection: "1X", probability: "80" }]).errors).toHaveLength(1);
  });
});
