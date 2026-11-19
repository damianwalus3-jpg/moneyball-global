import type { TrackerRecord } from "./tracker-store";

/** Returns the newest immutable prediction per fixture that has no final result. */
export function uniquePendingPredictions(records: TrackerRecord[]): TrackerRecord[] {
  const settled = new Set(records.filter(row => row.kind === "result"
    && typeof row.details.fixtureId === "string"
    && ["1", "X", "2", "VOID"].includes(String(row.details.actual)))
    .map(row => row.details.fixtureId as string));
  const ordered = records.filter(row => row.kind === "prediction" && typeof row.details.fixtureId === "string")
    .map((row, index) => ({ row, index, time: Date.parse(row.createdAt) }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.time) ? a.time : Number.NEGATIVE_INFINITY;
      const bTime = Number.isFinite(b.time) ? b.time : Number.NEGATIVE_INFINITY;
      return bTime - aTime || a.index - b.index;
    });
  const seen = new Set<string>();
  const pending: TrackerRecord[] = [];
  for (const item of ordered) {
    const fixtureId = item.row.details.fixtureId as string;
    if (settled.has(fixtureId) || seen.has(fixtureId)) continue;
    seen.add(fixtureId);
    pending.push(item.row);
  }
  return pending;
}
