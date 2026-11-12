import { describe, expect, it } from "vitest";
import { EXPECTED_PROJECT_REF, projectRefFromUrl, validatePublicKey, validateSupabaseUrl } from "./config";
import { parseScanRows } from "./scan-import";
import { brusselsInputToISO, isoToBrusselsInput } from "./time";
import { buildMigrationSql } from "./schema";

const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.y`;

describe("Supabase project and key safety", () => {
  it("pins the app to the dedicated free project, not the historical database", () => {
    expect(EXPECTED_PROJECT_REF).toBe("xwrgfaarmwnguymresjy");
    expect(projectRefFromUrl("https://xwrgfaarmwnguymresjy.supabase.co")).toBe(EXPECTED_PROJECT_REF);
    expect(validateSupabaseUrl("https://xwrgfaarmwnguymresjy.supabase.co")).toBeNull();
    expect(validateSupabaseUrl("https://gzgeklcukrclgwbsmbsp.supabase.co")).toContain("moneyball-global-free");
  });
  it("rejects secret and service_role keys", () => {
    expect(validatePublicKey("sb_secret_abcdefghijklmnop").ok).toBe(false);
    expect(validatePublicKey(jwt({ role: "service_role", ref: EXPECTED_PROJECT_REF })).ok).toBe(false);
  });
  it("accepts publishable and anon keys for the dedicated project", () => {
    expect(validatePublicKey("sb_publishable_abcdefghijklmnop").ok).toBe(true);
    expect(validatePublicKey(jwt({ role: "anon", ref: EXPECTED_PROJECT_REF })).ok).toBe(true);
    expect(validatePublicKey(jwt({ role: "anon", ref: "otherproject" })).ok).toBe(false);
  });
});

describe("Europe/Brussels time", () => {
  it("converts summer (CEST) and winter (CET) wall times", () => {
    expect(brusselsInputToISO("2026-07-01T20:00")).toBe("2026-07-01T18:00:00.000Z");
    expect(brusselsInputToISO("2026-01-15T20:00")).toBe("2026-01-15T19:00:00.000Z");
    expect(isoToBrusselsInput("2026-01-15T19:00:00.000Z")).toBe("2026-01-15T20:00");
  });
});

describe("scan import", () => {
  it("keeps weak predictions as ODRZUCONY instead of dropping the match", () => {
    const r = parseScanRows([
      { kickoff: "2026-11-14 20:45", league: "L1", home_team: "A", away_team: "B", prediction_type: "1X2", pick: "1", probability: "60" },
      { kickoff: "2026-11-14 20:45", league: "L1", home_team: "A", away_team: "B", prediction_type: "DC", pick: "1X", probability: "82%" },
      { kickoff: "2026-11-15 18:00", league: "L2", home_team: "C", away_team: "D" },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.matches).toHaveLength(2);
    expect(r.predictions.map((p) => p.selection_status)).toEqual(["ODRZUCONY", "WYBRANY"]);
    expect(r.predictions[1]?.prediction_type).toBe("DC");
  });
  it("reports invalid rows instead of skipping them silently", () => {
    const r = parseScanRows([{ kickoff: "", league: "L", home_team: "A", away_team: "B" }]);
    expect(r.errors).toHaveLength(1);
  });
});

describe("migration safety", () => {
  it("never contains destructive statements", () => {
    const sql = buildMigrationSql("user_id").toLowerCase();
    for (const bad of ["drop ", "truncate", "delete from", "alter column", "rename"]) expect(sql).not.toContain(bad);
    expect(sql).toContain("add column if not exists");
  });
});
