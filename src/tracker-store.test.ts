import { beforeEach, describe, expect, it } from "vitest";
import { exportBackup, importBackup, readRecords, addRecord, validateBackup } from "./tracker-store";

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
  it("rejects malformed backup", () => {
    expect(() => validateBackup({ version: 99 })).toThrow();
  });
});
