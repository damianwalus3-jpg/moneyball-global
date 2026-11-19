export type OddsSyncSlot = "morning" | "afternoon";
export const ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY = "moneyball.oddspapiDailyOddsAttemptDate";

export function oddsSyncAttemptKey(date: string, slot: OddsSyncSlot): string {
  return date + "|" + slot;
}

export function isOddsSyncCompleted(date: string, slot: OddsSyncSlot, persistedKey: string | null | undefined): boolean {
  return persistedKey === oddsSyncAttemptKey(date, slot);
}

export function markOddsSyncCompleted(
  storage: Pick<Storage, "setItem">,
  date: string,
  slot: OddsSyncSlot,
): string {
  const key = oddsSyncAttemptKey(date, slot);
  storage.setItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY, key);
  return key;
}

export function clearOddsSyncFailure(
  storage: Pick<Storage, "getItem" | "removeItem">,
  date: string,
  slot: OddsSyncSlot,
): void {
  const key = oddsSyncAttemptKey(date, slot);
  if (storage.getItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY) === key) {
    storage.removeItem(ODDSPAPI_DAILY_ATTEMPT_STORAGE_KEY);
  }
}
