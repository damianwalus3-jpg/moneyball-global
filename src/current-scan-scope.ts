import { trackerFixtureIdentity } from "./prediction-record";
import type { TrackerRecord } from "./tracker-store";

/** Preserve the append-only history while limiting current-day surfaces to live-scan fixtures. */
export function filterRecordsToCurrentScan(
  records: TrackerRecord[],
  eligibleFixtureIds: ReadonlySet<string>,
): TrackerRecord[] {
  return records.filter(record => {
    if (record.kind !== "match" && record.kind !== "prediction") return true;
    const fixtureId = trackerFixtureIdentity(record);
    return Boolean(fixtureId && eligibleFixtureIds.has(fixtureId));
  });
}
