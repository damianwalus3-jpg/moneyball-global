import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, validateBackup } from "./backup";

function backup(tables: Record<string, unknown>) {
  return { format: BACKUP_FORMAT, version: 1, exported_at: "2026-11-17T12:00:00.000Z", tables };
}

describe("backup restore preflight", () => {
  it("accepts valid table rows and returns a table-count preview", () => {
    const result = validateBackup(backup({
      matches: [{ id: "match-1", home_team: "A", away_team: "B" }],
      coupons: [{ id: "coupon-1" }, { id: "coupon-2" }],
      moneyball_jackpot_entries: [],
    }));
    expect(result.counts).toEqual({
      matches: 1,
      coupons: 2,
      moneyball_jackpot_entries: 0,
    });
  });

  it("rejects unsupported format versions before restore", () => {
    expect(() => validateBackup({ ...backup({}), version: 2 })).toThrow(/obsługiwana kopia/);
    expect(() => validateBackup({ ...backup({}), format: "other" })).toThrow(/obsługiwana kopia/);
  });

  it("rejects unknown tables and non-array table payloads", () => {
    expect(() => validateBackup(backup({ admin_users: [] }))).toThrow(/nieobsługiwaną tabelę/);
    expect(() => validateBackup(backup({ matches: { id: "x" } }))).toThrow(/listą rekordów/);
  });

  it("rejects rows without ids and duplicate ids within a table", () => {
    expect(() => validateBackup(backup({ matches: [{ home_team: "A" }] }))).toThrow(/wymagane jest id/);
    expect(() => validateBackup(backup({ matches: [{ id: "same" }, { id: "same" }] }))).toThrow(/Powtórzone id/);
  });

  it("validates audit trail rows and rejects duplicate audit IDs", () => {
    const result = validateBackup({
      ...backup({}),
      tracker_source_audit: [{
        id: "123e4567-e89b-42d3-a456-426614174000",
        entity_id: "123e4567-e89b-42d3-a456-426614174001",
        changed_by: "123e4567-e89b-42d3-a456-426614174002",
        entity_type: "prediction",
        new_source_class: "MODEL",
        changed_at: "2026-11-17T13:00:00Z",
      }],
    });
    expect(result.backup.tracker_source_audit).toHaveLength(1);
    expect(() => validateBackup({
      ...backup({}),
      tracker_source_audit: [{ id: "same" }, { id: "same" }],
    })).toThrow(/Nieprawidłowe pola wpisu audytu/);
    const valid = { id: "123e4567-e89b-42d3-a456-426614174000", entity_id: "123e4567-e89b-42d3-a456-426614174001", changed_by: "123e4567-e89b-42d3-a456-426614174002", entity_type: "prediction", new_source_class: "MODEL", previous_source_class: null, note: "verified", changed_at: "2026-11-17T13:00:00Z" };
    expect(() => validateBackup({ ...backup({}), tracker_source_audit: [valid, valid] })).toThrow(/Powtórzony identyfikator wpisu audytu/);
    expect(() => validateBackup({ ...backup({}), tracker_source_audit: [{ ...valid, previous_source_class: "UNKNOWN" }] })).toThrow(/Nieprawidłowe pola wpisu audytu/);
    expect(() => validateBackup({ ...backup({}), tracker_source_audit: [{ ...valid, note: "x".repeat(501) }] })).toThrow(/Nieprawidłowe pola wpisu audytu/);
  });

  it("rejects malformed top-level payloads", () => {
    expect(() => validateBackup(null)).toThrow(/Nieprawidłowy format/);
    expect(() => validateBackup([])).toThrow(/Nieprawidłowy format/);
  });
});
