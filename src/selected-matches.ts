import type { TrackerRecord } from "./tracker-store";

export interface SelectedFixturePredictions {
  fixtureId: string;
  one?: TrackerRecord;
  dc?: TrackerRecord;
}

export function brusselsDateToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Select the strongest available model record per fixture and market for one
 * Brussels calendar date. Historical/future-day rows are deliberately excluded.
 * xG history outranks recent-goals history, which outranks a neutral prior;
 * within one model priority, the newest record wins.
 */
export function getSelectedFixturePredictions(
  records: TrackerRecord[],
  targetDate: string,
): SelectedFixturePredictions[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return [];
  const latest = new Map<string, TrackerRecord>();
  const priority = (row: TrackerRecord) =>
    row.details.predictionMethod === "pitchapi-recent-xg-poisson" ? 3
      : row.details.predictionMethod === "recent-form-goals-poisson" ? 2 : 1;

  for (const row of records) {
    if (row.kind !== "prediction" || typeof row.details.fixtureId !== "string"
      || row.details.fixtureDate !== targetDate) continue;
    const market = row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
    const key = String(row.details.fixtureId) + "|" + market;
    const previous = latest.get(key);
    if (!previous || priority(row) > priority(previous)
      || (priority(row) === priority(previous) && Date.parse(row.createdAt) > Date.parse(previous.createdAt))) {
      latest.set(key, row);
    }
  }

  const fixtures = new Map<string, SelectedFixturePredictions>();
  for (const row of latest.values()) {
    const id = String(row.details.fixtureId);
    const item = fixtures.get(id) ?? { fixtureId: id };
    if (row.details.market === "DOUBLE_CHANCE") item.dc = row;
    else item.one = row;
    fixtures.set(id, item);
  }
  return [...fixtures.values()].sort((a, b) => {
    const dateA = String(a.one?.details.fixtureDate ?? a.dc?.details.fixtureDate ?? targetDate);
    const dateB = String(b.one?.details.fixtureDate ?? b.dc?.details.fixtureDate ?? targetDate);
    const timeA = String(a.one?.details.fixtureTime ?? a.dc?.details.fixtureTime ?? "99:99");
    const timeB = String(b.one?.details.fixtureTime ?? b.dc?.details.fixtureTime ?? "99:99");
    return dateA.localeCompare(dateB) || timeA.localeCompare(timeB)
      || String(a.one?.title ?? a.dc?.title ?? "").localeCompare(String(b.one?.title ?? b.dc?.title ?? ""));
  });
}
