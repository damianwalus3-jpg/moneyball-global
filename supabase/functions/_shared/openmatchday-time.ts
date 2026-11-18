/**
 * OpenMatchday CSVs document dates in UTC and kickoff clocks in fixed CET-1 (UTC+01:00).
 * Do not reinterpret those clocks as venue-local IANA times; that shifts Eastern European
 * fixtures in winter and most fixtures during summer.
 */
export function openMatchdayCET1ToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const value = new Date(date + "T" + time + ":00+01:00");
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}
