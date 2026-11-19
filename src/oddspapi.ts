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
export interface OddsPapiMarketDefinition {
  marketId: string;
  marketType: "1X2" | "DOUBLE_CHANCE";
  outcomeIds: Record<string, string>;
}
export interface OddsPapiQuote {
  providerFixtureId: string;
  market: "1X2" | "DOUBLE_CHANCE";
  bookmaker: string;
  bookmakerSlug: string;
  odds1: number | null;
  oddsX: number | null;
  odds2: number | null;
  odds1x: number | null;
  oddsX2: number | null;
  odds12: number | null;
  complete1X2: boolean;
  completeDoubleChance: boolean;
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
  "bwin.be", "unibet.be", "betfirst.be", "bingoal.be", "goldenpalacesports.be",
  "betcenter.be", "scooore.be", "starcasino.be", "napoleonsports.be",
  "bwin", "bwin.de", "bet365", "unibet", "ladbrokes", "betway", "pinnacle",
]);
export const DEFAULT_ODDS_PAPI_MARKETS: OddsPapiMarketDefinition[] = [{
  marketId: "101", marketType: "1X2", outcomeIds: { "1": "101", X: "102", "2": "103" },
}];

/** Spread the monthly OddsPapi allowance across remaining Brussels-local days and both sync slots. */
export function getOddsPapiSlotRequestBudget(
  remaining: number,
  slot: "morning" | "afternoon",
  now = new Date(),
): number {
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysRemaining = Math.max(1, daysInMonth - day + 1);
  const reserve = Math.min(5, Math.floor(remaining * 0.02));
  const dailyBudget = Math.floor(Math.max(0, remaining - reserve) / daysRemaining);
  const slotBudget = slot === "morning" ? Math.ceil(dailyBudget / 2) : Math.floor(dailyBudget / 2);
  return Math.min(10, Math.max(0, slotBudget));
}

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

function normalizeOutcome(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}
function findOutcomeId(outcomes: unknown[], aliases: string[]): string | null {
  const accepted = new Set(aliases.map(normalizeOutcome));
  for (const raw of outcomes) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (accepted.has(normalizeOutcome(row.outcomeName)) && (typeof row.outcomeId === "string" || typeof row.outcomeId === "number")) {
      return String(row.outcomeId);
    }
  }
  return null;
}
/** Discover full-time 1X2 and Double Chance market/outcome IDs from the provider catalogue. */
export function discoverOddsPapiMarkets(payload: unknown): OddsPapiMarketDefinition[] {
  if (!Array.isArray(payload)) return [];
  const found: OddsPapiMarketDefinition[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (row.sportId !== 10 || row.playerProp === true || String(row.period ?? "").toLowerCase() !== "fulltime") continue;
    if (!Array.isArray(row.outcomes) || typeof row.marketId !== "number" && typeof row.marketId !== "string") continue;
    const type = String(row.marketType ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = String(row.marketName ?? "").toLowerCase();
    const outcomes = row.outcomes as unknown[];
    if (type === "1x2" || name.includes("full time result")) {
      const ids = {
        "1": findOutcomeId(outcomes, ["1", "home"]),
        X: findOutcomeId(outcomes, ["x", "draw"]),
        "2": findOutcomeId(outcomes, ["2", "away"]),
      };
      if (ids["1"] && ids.X && ids["2"]) found.push({ marketId: String(row.marketId), marketType: "1X2", outcomeIds: ids as Record<string, string> });
    }
    if (type.includes("doublechance") || name.includes("double chance")) {
      const ids = {
        "1X": findOutcomeId(outcomes, ["1x", "1 or x", "home or draw", "home/draw"]),
        X2: findOutcomeId(outcomes, ["x2", "x or 2", "draw or away", "draw/away"]),
        "12": findOutcomeId(outcomes, ["12", "1 or 2", "home or away", "home/away"]),
      };
      if (ids["1X"] && ids.X2 && ids["12"]) found.push({ marketId: String(row.marketId), marketType: "DOUBLE_CHANCE", outcomeIds: ids as Record<string, string> });
    }
  }
  const first = (type: OddsPapiMarketDefinition["marketType"]) => found.find(row => row.marketType === type);
  return [first("1X2"), first("DOUBLE_CHANCE")].filter((row): row is OddsPapiMarketDefinition => !!row);
}

function validPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 1 && value <= 1000 ? value : null;
}
function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

/** Parse only active, unsuspended full-time 1X2 and Double Chance prices discovered in the market catalogue. */
export function parseOddsPapiQuotes(
  oddsPayload: unknown,
  bookmakerNames: Record<string, string>,
  marketDefinitions: OddsPapiMarketDefinition[] = DEFAULT_ODDS_PAPI_MARKETS,
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
      const bookmakerIsActive = book.bookmakerIsActive === true;
      const suspended = book.suspended === true;
      for (const definition of marketDefinitions) {
        const marketRaw = markets[definition.marketId];
        if (!marketRaw || typeof marketRaw !== "object") continue;
        const market = marketRaw as Record<string, unknown>;
        const outcomes = market.outcomes && typeof market.outcomes === "object" ? market.outcomes as Record<string, unknown> : {};
        const readOutcome = (key: string): { price: number | null; timestamp: string | null } => {
          const rawOutcome = outcomes[definition.outcomeIds[key]];
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
        const keys = definition.marketType === "1X2" ? ["1", "X", "2"] : ["1X", "X2", "12"];
        const values = keys.map(readOutcome);
        const bookmakerMarketActive = market.marketActive === true;
        const complete = bookmakerIsActive && !suspended && bookmakerMarketActive
          && values.every(item => item.price !== null);
        const priceTimes = values.map(item => item.timestamp);
        const allPriceTimesPresent = priceTimes.every((value): value is string => !!value);
        // Use the oldest timestamp so one stale selection makes the entire market snapshot stale.
        const capturedAt = allPriceTimesPresent
          ? priceTimes.sort((a, b) => Date.parse(a) - Date.parse(b))[0]
          : validTimestamp(event.updatedAt);
        const common = {
          providerFixtureId, bookmaker: bookmakerNames[slug] ?? slug, bookmakerSlug: slug,
          complete1X2: definition.marketType === "1X2" && complete,
          completeDoubleChance: definition.marketType === "DOUBLE_CHANCE" && complete,
          capturedAt: capturedAt ?? null,
          timestampBasis: allPriceTimesPresent ? "price_changed_at" as const : capturedAt ? "fixture_updated_at" as const : "missing" as const,
          bookmakerIsActive, suspended, marketActive: bookmakerMarketActive,
          fixturePath: typeof book.fixturePath === "string" ? book.fixturePath : null,
        };
        quotes.push(definition.marketType === "1X2" ? {
          ...common, market: "1X2",
          odds1: values[0].price, oddsX: values[1].price, odds2: values[2].price,
          odds1x: null, oddsX2: null, odds12: null,
        } : {
          ...common, market: "DOUBLE_CHANCE",
          odds1: null, oddsX: null, odds2: null,
          odds1x: values[0].price, oddsX2: values[1].price, odds12: values[2].price,
        });
      }
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
