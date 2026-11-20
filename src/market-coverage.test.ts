import { describe, expect, it } from "vitest";
import { auditMarketCoverage } from "./market-coverage";
import type { TrackerRecord } from "./tracker-store";
function row(kind: "match" | "prediction", id: string, details: Record<string, string | number | boolean | null> = {}): TrackerRecord {
  return { id: id + kind, kind, title: id, status: "OK", createdAt: "2026-11-18T10:00:00.000Z",
    details: { fixtureId: id, date: "2026-11-18", fixtureDate: "2026-11-18", ...details } };
}
describe("daily market coverage", () => {
  it("requires a separate 1X2 and Double Chance row for every scanned fixture", () => {
    const records = [
      row("match", "a"), row("match", "b"),
      row("prediction", "a", { ...validOne }),
      row("prediction", "a", { ...validDC }),
      row("prediction", "b", { ...validOne }),
    ];
    const audit = auditMarketCoverage(records, "2026-11-18");
    expect(audit.fixtureCount).toBe(2);
    expect(audit.oneXTwoFixtureCount).toBe(2);
    expect(audit.doubleChanceFixtureCount).toBe(1);
    expect(audit.missingDoubleChance).toEqual(["b"]);
    expect(audit.complete).toBe(false);
  });
  it("recognizes complete coverage and legacy 1X2 rows", () => {
    const records = [
      row("match", "a"), row("prediction", "a", { p1: 0.6, px: 0.2, p2: 0.2 }),
      row("prediction", "a", { ...validDC }),
    ];
    expect(auditMarketCoverage(records, "2026-11-18").complete).toBe(true);
  });
  it("matches predictions to the same fixture across different provider IDs", () => {
    const match = {
      ...row("match", "flashscore:100"),
      title: "2026-11-18 · Club Brugge vs KAA Gent",
      details: { fixtureId: "flashscore:100", date: "2026-11-18", competition: "Belgian Pro League" },
    };
    const one = row("prediction", "footynomad:200", {
      market: "1X2", ...validOne, fixtureDate: "2026-11-18", home: "Club Brugge", away: "KAA Gent", competition: "Belgian Pro League",
    });
    const dc = row("prediction", "flashscore:300", {
      market: "DOUBLE_CHANCE", p1x: 0.8, px2: 0.7, p12: 0.5, fixtureDate: "2026-11-18", home: "Club Brugge", away: "KAA Gent", competition: "Belgian Pro League",
    });
    const audit = auditMarketCoverage([match, one, dc], "2026-11-18");
    expect(audit.fixtureCount).toBe(1);
    expect(audit.oneXTwoFixtureCount).toBe(1);
    expect(audit.doubleChanceFixtureCount).toBe(1);
    expect(audit.complete).toBe(true);
  });
  it("does not count an invalid newest probability row as market coverage", () => {
    const validEarlier = row("prediction", "a", { ...validOne });
    validEarlier.createdAt = "2026-11-18T10:00:00.000Z";
    const invalidLatest = row("prediction", "a", { market: "1X2", p1: 0.6, px: 0.2, p2: 0.1 });
    invalidLatest.createdAt = "2026-11-18T11:00:00.000Z";
    const validDc = row("prediction", "a", { ...validDC });
    const audit = auditMarketCoverage([row("match", "a"), validEarlier, invalidLatest, validDc], "2026-11-18");
    expect(audit.oneXTwoFixtureCount).toBe(0);
    expect(audit.missingOneXTwo).toEqual(["a"]);
    expect(audit.doubleChanceFixtureCount).toBe(1);
    expect(audit.complete).toBe(false);
  });
  it("ignores fixtures from another day", () => {
    const records = [row("match", "today"), { ...row("match", "tomorrow"), details: { fixtureId: "tomorrow", date: "2026-11-19" } }];
    expect(auditMarketCoverage(records, "2026-11-18").fixtureCount).toBe(1);
  });
});
