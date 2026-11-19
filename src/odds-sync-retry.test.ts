import { describe, expect, it } from "vitest";
import {
  clearOddsSyncFailure,
  isOddsSyncCompleted,
  markOddsSyncCompleted,
  ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY,
  oddsSyncAttemptKey,
} from "./odds-sync-retry";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

describe("OddsPapi retry markers", () => {
  it("uses independent Brussels date/slot markers", () => {
    expect(oddsSyncAttemptKey("2026-11-19", "morning")).toBe("2026-11-19|morning");
    expect(isOddsSyncCompleted("2026-11-19", "morning", "2026-11-19|afternoon")).toBe(false);
    expect(isOddsSyncCompleted("2026-11-19", "afternoon", "2026-11-19|afternoon")).toBe(true);
  });

  it("persists only an explicitly successful sync", () => {
    const storage = memoryStorage();
    const key = markOddsSyncCompleted(storage, "2026-11-19", "morning");
    expect(key).toBe("2026-11-19|morning");
    expect(storage.getItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY)).toBe(key);
    expect(isOddsSyncCompleted("2026-11-19", "morning", storage.getItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY))).toBe(true);
  });

  it("clears only the matching failed slot so it can be retried", () => {
    const storage = memoryStorage();
    storage.setItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY, "2026-11-19|afternoon");
    clearOddsSyncFailure(storage, "2026-11-19", "morning");
    expect(storage.getItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY)).toBe("2026-11-19|afternoon");
    clearOddsSyncFailure(storage, "2026-11-19", "afternoon");
    expect(storage.getItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY)).toBeNull();
  });

  it("does not treat legacy date-only markers as a successful slot", () => {
    expect(isOddsSyncCompleted("2026-11-19", "morning", "2026-11-19")).toBe(false);
  });
});
