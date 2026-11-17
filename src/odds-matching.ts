export interface OddsMatchFixture {
  id: string;
  date: string;
  time: string;
  home: string;
  away: string;
}
export interface OddsProviderGame {
  gameId: string;
  startsAt: string;
  home: string;
  away: string;
}
export interface OddsFixtureMatch {
  fixtureId: string;
  gameId: string;
  kickoffDifferenceMinutes: number;
}
export interface OddsMatchAudit {
  matched: OddsFixtureMatch[];
  unmatchedFixtureIds: string[];
  ambiguousFixtureIds: string[];
  unmatchedProviderGameIds: string[];
}

function normalizeTeam(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(united)\b/g, "utd")
    .replace(/\b(football club|fc|afc|cf|sc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function brusselsParts(value: string): { date: string; time: string } | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(parsed);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function minutesOfDay(value: string): number | null {
  if (!/^[0-9]{2}:[0-9]{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Conservative matching: exact normalized home/away names, same Brussels date,
 * and a bounded kickoff difference. Ambiguous candidates are never auto-linked.
 */
export function auditOddsFixtureMatches(
  fixtures: OddsMatchFixture[],
  games: OddsProviderGame[],
  maxKickoffDifferenceMinutes = 30,
): OddsMatchAudit {
  const candidates = fixtures.map(fixture => {
    const fixtureHome = normalizeTeam(fixture.home);
    const fixtureAway = normalizeTeam(fixture.away);
    const fixtureMinute = minutesOfDay(fixture.time);
    if (!fixtureHome || !fixtureAway || fixtureMinute === null) return { fixture, matches: [] as Array<{ game: OddsProviderGame; difference: number }> };
    const matches = games.flatMap(game => {
      if (!game.gameId || normalizeTeam(game.home) !== fixtureHome || normalizeTeam(game.away) !== fixtureAway) return [];
      const kickoff = brusselsParts(game.startsAt);
      if (!kickoff || kickoff.date !== fixture.date) return [];
      const providerMinute = minutesOfDay(kickoff.time);
      if (providerMinute === null) return [];
      const difference = Math.abs(providerMinute - fixtureMinute);
      return difference <= maxKickoffDifferenceMinutes ? [{ game, difference }] : [];
    });
    return { fixture, matches };
  });

  const ambiguousFixtureIds = candidates.filter(item => item.matches.length > 1).map(item => item.fixture.id);
  const uniqueCandidates = candidates.filter(item => item.matches.length === 1);
  const gameUseCount = new Map<string, number>();
  for (const item of uniqueCandidates) {
    const id = item.matches[0].game.gameId;
    gameUseCount.set(id, (gameUseCount.get(id) ?? 0) + 1);
  }
  const reusedGameIds = new Set([...gameUseCount].filter(([, count]) => count > 1).map(([id]) => id));
  const reusedFixtureIds = uniqueCandidates.filter(item => reusedGameIds.has(item.matches[0].game.gameId)).map(item => item.fixture.id);
  const allAmbiguousFixtureIds = [...new Set([...ambiguousFixtureIds, ...reusedFixtureIds])];
  const matched = uniqueCandidates.flatMap(item => {
    const candidate = item.matches[0];
    if (gameUseCount.get(candidate.game.gameId) !== 1) return [];
    return [{ fixtureId: item.fixture.id, gameId: candidate.game.gameId, kickoffDifferenceMinutes: candidate.difference }];
  });
  const matchedFixtureIds = new Set(matched.map(item => item.fixtureId));
  const ambiguous = new Set(allAmbiguousFixtureIds);
  const unmatchedFixtureIds = fixtures.filter(item => !matchedFixtureIds.has(item.id) && !ambiguous.has(item.id)).map(item => item.id);
  const matchedGameIds = new Set(matched.map(item => item.gameId));
  const unmatchedProviderGameIds = games.filter(item => !matchedGameIds.has(item.gameId)).map(item => item.gameId);
  return { matched, unmatchedFixtureIds, ambiguousFixtureIds: allAmbiguousFixtureIds, unmatchedProviderGameIds };
}
