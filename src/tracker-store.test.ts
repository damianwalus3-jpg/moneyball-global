import { beforeEach, describe, expect, it } from "vitest";
import { addRecord, addRecordsIfMissing, exportBackup, exportCsv, importBackup, readRecords, validateBackup } from "./tracker-store";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
}});
Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID: () => "fixed-id" }});

beforeEach(() => memory.clear());

describe("local tracker", () => {
  it("persists records locally", () => {
    addRecord({ kind: "match", title: "Team A — Team B", status: "scheduled", details: {} });
    expect(readRecords()).toHaveLength(1);
  });
  it("exports a versioned backup", () => {
    addRecord({ kind: "prediction", title: "1X2", status: "candidate", details: { home: 0.5 } });
    expect(exportBackup().format).toBe("moneyball-local-backup");
    expect(exportBackup().records).toHaveLength(1);
  });
  it("exports all tracker fields as correctly escaped CSV", () => {
    addRecord({ kind: "match", title: "Team, home", status: "scheduled", details: { fixtureId: "fx-1", note: "line one" } });
    const csv = exportCsv();
    expect(csv).toContain('"id","createdAt","kind","title","status","details"');
    expect(csv).toContain('"Team, home"');
    expect(csv).toContain('"fx-1"');
  });
  it("imports only missing IDs and preserves existing records", () => {
    addRecord({ kind: "match", title: "Original", status: "scheduled", details: {} });
    const backup = { format: "moneyball-local-backup", version: 1, exportedAt: new Date().toISOString(), records: [
      { id: "fixed-id", kind: "match", title: "Backup overwrite", status: "finished", details: {}, createdAt: new Date().toISOString() },
      { id: "new-id", kind: "result", title: "New result", status: "verified", details: {}, createdAt: new Date().toISOString() },
    ]};
    expect(importBackup(backup)).toBe(1);
    expect(readRecords()).toHaveLength(2);
    expect(readRecords().find(row => row.id === "fixed-id")?.title).toBe("Original");
  });
  it("keeps result and coupon settlement inserts idempotent by their parent keys", () => {
    const result = { kind: "result" as const, title: "Fixture result", status: "SETTLED", details: { fixtureId: "fx-1", actual: "1" } };
    const child = { kind: "coupon" as const, title: "Coupon settled", status: "PAPER_HIT", details: { parentCouponId: "coupon-1" } };
    expect(addRecordsIfMissing([result], "fixtureId")).toBe(1);
    expect(addRecordsIfMissing([result], "fixtureId")).toBe(0);
    expect(addRecordsIfMissing([child], "parentCouponId")).toBe(1);
    expect(addRecordsIfMissing([child], "parentCouponId")).toBe(0);
    expect(readRecords().filter(row => row.kind === "result")).toHaveLength(1);
    expect(readRecords().filter(row => row.kind === "coupon")).toHaveLength(1);
  });
  it("sorts merged backup history newest-first without overwriting existing IDs", () => {
    const now = "2999-11-17T20:00:00.000Z";
    addRecord({ kind: "match", title: "Existing", status: "scheduled", details: {} });
    const backup = { format: "moneyball-local-backup", version: 1, exportedAt: now, records: [
      { id: "old", kind: "result", title: "Older", status: "SETTLED", details: {}, createdAt: "2026-11-16T10:00:00.000Z" },
      { id: "new", kind: "result", title: "Newer", status: "SETTLED", details: {}, createdAt: now },
    ]};
    importBackup(backup);
    const rows = readRecords();
    expect(rows.map(row => row.id)).toEqual(["new", "fixed-id", "old"]);
    expect(rows.find(row => row.id === "fixed-id")?.title).toBe("Existing");
  });
  it("allows a verified result after a malformed legacy result for the same fixture", () => {
    addRecord({ kind: "result", title: "Bad legacy result", status: "SETTLED", details: { fixtureId: "fx-1", actual: "?" } });
    const valid = { kind: "result" as const, title: "Verified result", status: "SETTLED", details: { fixtureId: "fx-1", actual: "1" } };
    expect(addRecordsIfMissing([valid], "fixtureId")).toBe(1);
    expect(addRecordsIfMissing([valid], "fixtureId")).toBe(0);
    expect(readRecords().filter(row => row.kind === "result" && row.details.actual === "1")).toHaveLength(1);
  });
  it("rejects malformed backup", () => {
    expect(() => validateBackup({ version: 99 })).toThrow();
    expect(() => validateBackup({ format: "moneyball-local-backup", version: 1, records: [{ id: "x", kind: "match", title: "bad", status: "x", details: [], createdAt: "now" }] })).toThrow();
    expect(() => validateBackup({ format: "moneyball-local-backup", version: 1, records: [{ id: "x", kind: "match", title: "bad", status: "x", details: { nested: { unsafe: true } }, createdAt: new Date().toISOString() }] })).toThrow();
  });
  it("deduplicates repeated IDs inside an imported backup", () => {
    const createdAt = new Date().toISOString();
    const backup = { format: "moneyball-local-backup", version: 1, exportedAt: createdAt, records: [
      { id: "same-id", kind: "match", title: "First", status: "scheduled", details: {}, createdAt },
      { id: "same-id", kind: "match", title: "Duplicate", status: "finished", details: {}, createdAt },
    ]};
    expect(importBackup(backup)).toBe(1);
    expect(readRecords()).toHaveLength(1);
    expect(readRecords()[0].title).toBe("First");
  });
  it("stores scanned fixtures once and never overwrites an existing fixture row", () => {
    const fixture = { kind: "match" as const, title: "Team A — Team B", status: "SCHEDULED", details: { fixtureId: "provider|fixture-1", date: "2026-11-17" } };
    expect(addRecordsIfMissing([fixture], "fixtureId")).toBe(1);
    expect(addRecordsIfMissing([{ ...fixture, title: "Changed title", status: "FINISHED" }], "fixtureId")).toBe(0);
    expect(readRecords()).toHaveLength(1);
    expect(readRecords()[0].title).toBe("Team A — Team B");
  });
});
