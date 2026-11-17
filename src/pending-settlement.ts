import type { TrackerRecord } from "./tracker-store";

/** Returns one newest-first pending prediction per unsettled fixture. */
export function uniquePendingPredictions(records: TrackerRecord[]): TrackerRecord[] {
  const settled = new Set(records.filter(row => row.kind === "result" && typeof row.details.fixtureId === "string" && ["1", "X", "2"].includes(String(row.details.actual))).map(row => row.details.fixtureId as string));
  const seen = new Set<string>();
  const pending: TrackerRecord[] = [];
  for (const row of records) {
    const fixtureId = row.details.fixtureId;
    if (row.kind !== "prediction" || typeof fixtureId !== "string" || settled.has(fixtureId) || seen.has(fixtureId)) continue;
    seen.add(fixtureId);
    pending.push(row);
  }
  return pending;
}
