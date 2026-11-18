export type ProviderOddsQuote = {
  odds?: unknown;
  bookmaker?: unknown;
  provider?: unknown;
  phase?: unknown;
  suspended?: unknown;
  mapped_market?: unknown;
  mapped_selection?: unknown;
  captured_at?: unknown;
  price_timestamp?: unknown;
  provider_polled_at?: unknown;
};

const APPROVED_BOOKMAKERS = ["bwin", "unibet", "ladbrokes", "circus", "betfirst"] as const;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function normalized(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function belgianBookmakerPriority(value: unknown): number {
  const name = normalized(value);
  const index = APPROVED_BOOKMAKERS.findIndex((allowed) => name.includes(allowed));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function freshTimestamp(value: unknown, nowMs: number): boolean {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp <= SIX_HOURS_MS;
}

/** Provider rows have no status column: confirmed is derived from fresh timestamps,
 * prematch phase, unsuspended state, a valid price, mapped match market and approved Belgian bookmaker.
 */
export function isFreshConfirmedBelgianProviderQuote(quote: ProviderOddsQuote, nowMs = Date.now()): boolean {
  const provider = String(quote.provider ?? "").trim();
  const market = String(quote.mapped_market ?? "").trim().toUpperCase();
  const selection = String(quote.mapped_selection ?? "").trim();
  const captured = quote.captured_at;
  const polled = quote.provider_polled_at ?? captured;
  const priced = quote.price_timestamp ?? polled ?? captured;
  return Number(quote.odds) > 1
    && belgianBookmakerPriority(quote.bookmaker) !== Number.MAX_SAFE_INTEGER
    && provider.length > 0
    && !/(tipsaudit|fair.?market|strikerapi)/i.test(provider)
    && String(quote.phase ?? "").trim().toLowerCase() === "prematch"
    && quote.suspended === false
    && ["1X2", "DOUBLE_CHANCE", "GOALS"].includes(market)
    && selection.length > 0
    && freshTimestamp(captured, nowMs)
    && freshTimestamp(polled, nowMs)
    && freshTimestamp(priced, nowMs);
}

/** Negative means left is preferred: Bwin first, then Unibet, Ladbrokes, Circus, betFIRST; freshest breaks ties. */
export function compareBelgianProviderQuotes(left: ProviderOddsQuote, right: ProviderOddsQuote): number {
  const priority = belgianBookmakerPriority(left.bookmaker) - belgianBookmakerPriority(right.bookmaker);
  if (priority !== 0) return priority;
  return Date.parse(String(right.captured_at ?? "")) - Date.parse(String(left.captured_at ?? ""));
}

export function isFreshConfirmedManualBelgianQuote(
  odds: unknown,
  coverage: Record<string, unknown> | null | undefined,
  nowMs = Date.now(),
): boolean {
  const numericOdds = Number(odds);
  if (!coverage || !Number.isFinite(numericOdds) || numericOdds <= 1) return false;
  const source = String(coverage["odds_source"] ?? "").trim().toLowerCase();
  const url = String(coverage["odds_source_url"] ?? "").trim();
  const bookmaker = coverage["odds_bookmaker"];
  const capturedAt = coverage["odds_captured_at"];
  const suspended = coverage["odds_suspended"] === true || String(coverage["odds_suspended"] ?? "").toLowerCase() === "true";
  return source === "manual"
    && belgianBookmakerPriority(bookmaker) !== Number.MAX_SAFE_INTEGER
    && /^https?:\/\/[^\s]+$/i.test(url)
    && String(coverage["odds_status"] ?? "").toUpperCase() === "CONFIRMED"
    && String(coverage["odds_phase"] ?? "").trim().toLowerCase() === "prematch"
    && !suspended
    && freshTimestamp(capturedAt, nowMs);
}
