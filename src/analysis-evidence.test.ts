import { describe, expect, it } from "vitest";
import {
  buildBaselineEvidenceAudit, getBettingEvidenceGaps, getEvidenceGaps,
  isBettingEvidenceComplete, isEvidenceAuditComplete, type EvidenceArea,
} from "./analysis-evidence";
describe("analysis evidence gate", () => {
  it("marks unavailable factors missing rather than inventing values", () => {
    const audit = buildBaselineEvidenceAudit("2026-11-18T10:00:00Z");
    expect(audit.complete).toBe(false);
    expect(Object.values(audit.areas).every(item => item.status === "MISSING" && item.source === null)).toBe(true);
    expect(getEvidenceGaps(audit)).toHaveLength(7);
    expect(getBettingEvidenceGaps(audit)).toHaveLength(8);
  });
  it("requires all seven timestamped sports-analysis observations to be verified", () => {
    const audit = buildBaselineEvidenceAudit("2026-11-18T10:00:00Z");
    for (const key of Object.keys(audit.areas) as EvidenceArea[]) {
      if (key === "current_odds_ev") continue;
      audit.areas[key] = { status: "VERIFIED", source: "verified test provider", observedAt: "2026-11-18T09:59:00Z", note: "test" };
    }
    expect(isEvidenceAuditComplete(audit)).toBe(true);
    expect(isBettingEvidenceComplete(audit)).toBe(false);
    expect(getEvidenceGaps(audit)).toEqual([]);
    expect(getBettingEvidenceGaps(audit)).toEqual(["aktualne kursy i EV (wycena zakładu)"]);
  });
  it("requires a verified current price only for betting readiness", () => {
    const audit = buildBaselineEvidenceAudit("2026-11-18T10:00:00Z");
    for (const key of Object.keys(audit.areas) as EvidenceArea[]) {
      audit.areas[key] = { status: "VERIFIED", source: "verified test provider", observedAt: "2026-11-18T09:59:00Z", note: "test" };
    }
    expect(isEvidenceAuditComplete(audit)).toBe(true);
    expect(isBettingEvidenceComplete(audit)).toBe(true);
    audit.areas.current_odds_ev.status = "STALE";
    expect(isEvidenceAuditComplete(audit)).toBe(true);
    expect(isBettingEvidenceComplete(audit)).toBe(false);
  });
  it("rejects future timestamps and missing provenance for core evidence", () => {
    const audit = buildBaselineEvidenceAudit("2026-11-18T10:00:00Z");
    for (const key of Object.keys(audit.areas) as EvidenceArea[]) {
      audit.areas[key] = { status: "VERIFIED", source: "provider", observedAt: "2026-11-18T10:01:00Z", note: "test" };
    }
    expect(isEvidenceAuditComplete(audit)).toBe(false);
  });
});
