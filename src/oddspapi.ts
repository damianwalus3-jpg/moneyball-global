import { auditOddsFixtureMatches, type OddsMatchFixture, type OddsProviderGame } from "./odds-matching";

export interface OddsPapiFixture {
  fixtureId: string;
  tournamentId: number;
  startTime: string;
  participant1Name: string;
  participant2Name: string;
  updatedAt?: string | null;
}
export interface OddsPapiBookmaker {
  bookmakerName: string;
  slug: string;
}
export interface OddsPapiQuote {
  providerFixtureId: string;
  bookmaker: string;
  bookmakerSlug: string;
  odds1: number | null;
  oddsX: number | null;
  odds2: number | null;
  complete1X2: boolean;
  capturedAt: string | null;
  timestampBasis: "price_changed_at" | "fixture_updated_at" | "missing";
  bookmakerIsActive: boolean;
  suspended: boolean;
  marketActive: boolean;
  fixturePath: string | null;
}
export interface OddsPapiFixtureMatch {
  fixtureId: string;
  providerFixtureId: string;
  tournamentId: number;
  kickoffDifferenceMinutes: number;
}
const TARGET_BOOKMAKER_SLUGS = new Set([
  "bwin.be", "bwin", "bwin.de", "bet365", "unibet", "ladbrokes",
  "circus", "betfirst", "betway", "pinnacle",
]);

export function brusselsUtcDayWindow(date: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid_brussels_date");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error("invalid_brussels_date");
  }
  const next = new Date(Date.UTC(year, month - 1, day) + 86400000).toISOString().slice(0, 10);
  const localMidnightUtc = (localDate: string): string => {
    const [y, m, d] = localDate.split("-").map(Number);
    const desired = Date.UTC(y, m - 1, d, 0, 0, 0);
    let candidate = desired;
    for (let attempt = 0; attempt < 4; attempt++) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(candidate));
      const get = (key: string) => Number(parts.find(part => part.type === key)?.value ?? 0);
      const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
      const correction = desired - represented;
      candidate += correction;
      if (correction === 0) break;
    }
    return new Date(candidate).toISOString();
  };
  return { from: localMidnightUtc(date), to: localMidnightUtc(next) };
}

export function matchOddsPapiFixtures(
  fixtures: OddsMatchFixture[],
  providerFixtures: OddsPapiFixture[],
  maxKickoffDifferenceMinutes = 30,
): { matched: OddsPapiFixtureMatch[]; unmatchedFixtureIds: string[]; ambiguousFixtureIds: string[] } {
  const games: OddsProviderGame[] = providerFixtures.map(row => ({
    gameId: row.fixtureId, startsAt: row.startTime,
    home: row.participant1Name, away: row.participant2Name,
  }));
  const audit = auditOddsFixtureMatches(fixtures, games, maxKickoffDifferenceMinutes);
  const byId = new Map(providerFixtures.map(row => [row.fixtureId, row]));
  return {
    matched: audit.matched.flatMap(row => {
      const provider = byId.get(row.gameId);
      return provider ? [{ fixtureId: row.fixtureId, providerFixtureId: row.gameId,
        tournamentId: provider.tournamentId, kickoffDifferenceMinutes: row.kickoffDifferenceMinutes }] : [];
    }),
    unmatchedFixtureIds: audit.unmatchedFixtureIds,
    ambiguousFixtureIds: audit.ambiguousFixtureIds,
  };
}

function validPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 1 && value <= 1000 ? value : null;
}
function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

/** Parse only active, unsuspended full-time 1X2 market 101 (1/X/2). */
export function parseOddsPapiQuotes(
  oddsPayload: unknown,
  bookmakerNames: Record<string, string>,
): OddsPapiQuote[] {
  const events = Array.isArray(oddsPayload) ? oddsPayload
    : oddsPayload && typeof oddsPayload === "object" && Array.isArray((oddsPayload as { fixtures?: unknown }).fixtures)
      ? (oddsPayload as { fixtures: unknown[] }).fixtures
      : oddsPayload && typeof oddsPayload === "object" && typeof (oddsPayload as { fixtureId?: unknown }).fixtureId === "string"
        ? [oddsPayload] : [];
  const quotes: OddsPapiQuote[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;
    const providerFixtureId = typeof event.fixtureId === "string" ? event.fixtureId : "";
    if (!providerFixtureId || !event.bookmakerOdds || typeof event.bookmakerOdds !== "object") continue;
    const bookmakerOdds = event.bookmakerOdds as Record<string, unknown>;
    for (const [slug, rawBook] of Object.entries(bookmakerOdds)) {
      if (!rawBook || typeof rawBook !== "object") continue;
      const book = rawBook as Record<string, unknown>;
      const markets = book.markets && typeof book.markets === "object" ? book.markets as Record<string, unknown> : {};
      const marketRaw = markets["101"];
      const market = marketRaw && typeof marketRaw === "object" ? marketRaw as Record<string, unknown> : {};
      const outcomes = market.outcomes && typeof market.outcomes === "object" ? market.outcomes as Record<string, unknown> : {};
      const readOutcome = (id: string): { price: number | null; timestamp: string | null } => {
        const rawOutcome = outcomes[id];
        if (!rawOutcome || typeof rawOutcome !== "object") return { price: null, timestamp: null };
        const players = (rawOutcome as Record<string, unknown>).players;
        if (!players || typeof players !== "object") return { price: null, timestamp: null };
        const player = (players as Record<string, unknown>)["0"];
        if (!player || typeof player !== "object") return { price: null, timestamp: null };
        const item = player as Record<string, unknown>;
        return {
          price: item.active === true ? validPrice(item.price) : null,
          timestamp: validTimestamp(item.bookmakerChangedAt) ?? validTimestamp(item.changedAt),
        };
      };
      const one = readOutcome("101"), draw = readOutcome("102"), two = readOutcome("103");
      const bookmakerIsActive = book.bookmakerIsActive === true;
      const suspended = book.suspended === true;
      const marketActive = market.marketActive === true;
      const complete1X2 = bookmakerIsActive && !suspended && marketActive
        && one.price !== null && draw.price !== null && two.price !== null;
      const priceTimes = [one.timestamp, draw.timestamp, two.timestamp].filter((value): value is string => !!value);
      const capturedAt = priceTimes.length
        ? priceTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0]
        : validTimestamp(event.updatedAt);
      quotes.push({
        providerFixtureId,
        bookmaker: bookmakerNames[slug] ?? slug,
        bookmakerSlug: slug,
        odds1: one.price, oddsX: draw.price, odds2: two.price,
        complete1X2,
        capturedAt: capturedAt ?? null,
        timestampBasis: priceTimes.length ? "price_changed_at" : capturedAt ? "fixture_updated_at" : "missing",
        bookmakerIsActive, suspended, marketActive,
        fixturePath: typeof book.fixturePath === "string" ? book.fixturePath : null,
      });
    }
  }
  return quotes;
}

export function selectOddsPapiBookmakers(
  catalog: OddsPapiBookmaker[],
  activeSubscriptionBookmakers: string[],
): OddsPapiBookmaker[] {
  const entitled = new Set(activeSubscriptionBookmakers.map(value => value.toLowerCase()));
  return catalog.filter(book => TARGET_BOOKMAKER_SLUGS.has(book.slug.toLowerCase())
    && entitled.has(book.slug.toLowerCase()));
}
