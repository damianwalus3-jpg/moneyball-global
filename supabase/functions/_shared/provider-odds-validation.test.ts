import {
  belgianBookmakerPriority,
  compareBelgianProviderQuotes,
  isFreshConfirmedBelgianProviderQuote,
  isFreshConfirmedManualBelgianQuote,
} from "./provider-odds-validation.ts";

const now = Date.parse("2026-11-18T08:00:00.000Z");
const fresh = {
  odds: 2.1, bookmaker: "Bwin Belgium", provider: "MoviOdds",
  phase: "prematch", suspended: false, mapped_market: "1X2", mapped_selection: "1",
  captured_at: "2026-11-18T07:30:00.000Z",
  price_timestamp: "2026-11-18T07:29:00.000Z",
  provider_polled_at: "2026-11-18T07:30:00.000Z",
};

Deno.test("accepts only fresh, confirmed, prematch match prices from approved Belgian bookmakers", () => {
  if (!isFreshConfirmedBelgianProviderQuote(fresh, now)) throw new Error("Fresh Bwin quote should be accepted.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, bookmaker: "bet365" }, now)) throw new Error("Non-Belgian bookmaker must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, phase: "inplay" }, now)) throw new Error("In-play quote must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, suspended: true }, now)) throw new Error("Suspended quote must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, odds: 1 }, now)) throw new Error("Invalid price must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, captured_at: "2026-11-18T01:00:00.000Z" }, now)) throw new Error("Stale quote must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, captured_at: "2026-11-18T08:01:00.000Z" }, now)) throw new Error("Future capture must be rejected.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, provider: "TipsAudit fair market" }, now)) throw new Error("Fair-market source must not be treated as payout odds.");
  if (isFreshConfirmedBelgianProviderQuote({ ...fresh, mapped_market: null }, now)) throw new Error("Unmapped market must be rejected.");
});

Deno.test("bookmaker priority follows Belgian source preference", () => {
  if (!(belgianBookmakerPriority("Bwin Belgium") < belgianBookmakerPriority("Unibet Belgium"))) throw new Error("Bwin must be preferred over Unibet.");
  if (!(belgianBookmakerPriority("Unibet Belgium") < belgianBookmakerPriority("Ladbrokes Belgium"))) throw new Error("Unibet must be preferred over Ladbrokes.");
  if (!(compareBelgianProviderQuotes(fresh, { ...fresh, bookmaker: "Unibet Belgium" }) < 0)) throw new Error("Bwin quote must win priority.");
});

Deno.test("manual Belgian payout quotes must have valid URL, bookmaker, status, phase and fresh capture time", () => {
  const manual = {
    odds_source: "manual", odds_bookmaker: "Bwin Belgium",
    odds_captured_at: "2026-11-18T07:30:00.000Z",
    odds_phase: "prematch", odds_status: "CONFIRMED",
    odds_suspended: false, odds_source_url: "https://www.bwin.be/",
  };
  if (!isFreshConfirmedManualBelgianQuote(2.1, manual, now)) throw new Error("Fresh Bwin manual quote should be accepted.");
  if (isFreshConfirmedManualBelgianQuote(2.1, { ...manual, odds_bookmaker: "bet365" }, now)) throw new Error("Non-Belgian manual bookmaker must be rejected.");
  if (isFreshConfirmedManualBelgianQuote(2.1, { ...manual, odds_source_url: "javascript:alert(1)" }, now)) throw new Error("Invalid URL must be rejected.");
  if (isFreshConfirmedManualBelgianQuote(2.1, { ...manual, odds_captured_at: "2026-11-18T01:00:00.000Z" }, now)) throw new Error("Stale manual quote must be rejected.");
  if (isFreshConfirmedManualBelgianQuote(2.1, { ...manual, odds_phase: "inplay" }, now)) throw new Error("In-play manual quote must be rejected.");
  if (isFreshConfirmedManualBelgianQuote(2.1, { ...manual, odds_status: "SUSPENDED" }, now)) throw new Error("Unconfirmed manual quote must be rejected.");
});
