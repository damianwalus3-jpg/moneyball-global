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
      row("prediction", "a", { market: "1X2" }),
      row("prediction", "a", { market: "DOUBLE_CHANCE" }),
      row("prediction", "b", { market: "1X2" }),
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
      row("match", "a"), row("prediction", "a"),
      row("prediction", "a", { market: "DOUBLE_CHANCE" }),
    ];
    expect(auditMarketCoverage(records, "2026-11-18").complete).toBe(true);
  });
  it("ignores fixtures from another day", () => {
    const records = [row("match", "today"), { ...row("match", "tomorrow"), details: { fixtureId: "tomorrow", date: "2026-11-19" } }];
    expect(auditMarketCoverage(records, "2026-11-18").fixtureCount).toBe(1);
  });
});
