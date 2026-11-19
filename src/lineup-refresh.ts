export interface PitchApiLineupCheck {
  home?: { confirmed?: boolean; lineup_type?: string; starters?: unknown[] };
  away?: { confirmed?: boolean; lineup_type?: string; starters?: unknown[] };
}

/** Convert a Brussels-local fixture date/time to an epoch timestamp without relying on the device timezone. */
export function brusselsKickoffTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallClockUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day
    || hour > 23 || minute > 59) return null;

  let timestamp = wallClockUtc;
  for (let attempt = 0; attempt < 3; attempt++) {
    const zone = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Brussels", timeZoneName: "shortOffset",
    }).formatToParts(new Date(timestamp)).find(part => part.type === "timeZoneName")?.value ?? "GMT+0";
    const match = zone.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    const offset = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
    const next = wallClockUtc - offset * 60_000;
    if (next === timestamp) break;
    timestamp = next;
  }
  return timestamp;
}

export function isWithinLineupRefreshWindow(
  date: string,
  time: string,
  now = Date.now(),
  windowMinutes = 360,
): boolean {
  const kickoff = brusselsKickoffTimestamp(date, time);
  if (kickoff === null) return false;
  const minutesUntilKickoff = (kickoff - now) / 60_000;
  return minutesUntilKickoff >= 0 && minutesUntilKickoff <= windowMinutes;
}

export function isConfirmedPitchApiLineups(lineups: PitchApiLineupCheck | null | undefined): boolean {
  return !!lineups
    && lineups.home?.confirmed === true && lineups.away?.confirmed === true
    && lineups.home.starters?.length === 11 && lineups.away.starters?.length === 11;
}


/** A provider-supplied projected XI is useful evidence, but is not a confirmed lineup. */
export function isProjectedPitchApiLineups(lineups: PitchApiLineupCheck | null | undefined): boolean {
  const home = lineups?.home;
  const away = lineups?.away;
  const hasProjectedEvidence = (side: typeof home) =>
    typeof side?.lineup_type === "string" && /predict|project|expected/i.test(side.lineup_type);
  const hasElevenStarters = (side: typeof home) => side?.starters?.length === 11;
  return !isConfirmedPitchApiLineups(lineups)
    && hasElevenStarters(home) && hasElevenStarters(away)
    && (hasProjectedEvidence(home) || hasProjectedEvidence(away));
}

export function getPitchApiLineupStatus(lineups: PitchApiLineupCheck | null | undefined): "LINEUP_CONFIRMED" | "LINEUP_PREDICTED" | "LINEUP_PENDING" {
  if (isConfirmedPitchApiLineups(lineups)) return "LINEUP_CONFIRMED";
  if (isProjectedPitchApiLineups(lineups)) return "LINEUP_PREDICTED";
  return "LINEUP_PENDING";
}
