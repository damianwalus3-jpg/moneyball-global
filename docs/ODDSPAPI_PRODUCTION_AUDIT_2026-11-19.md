# MONEYBALL GLOBAL REBUILT — production OddsPapi and European source audit
**Audit date:** 2026-11-19  
**Repository:** `damianwalus3-jpg/moneyball-global`  
**Branch:** `moneyball-rebuild`  
**Production Worker:** https://moneyball-global-rebuild.damianwalus3.workers.dev/  
**Validated commit:** `a874f04f7027122c23046df98ac7129387c68a56`

## 1. Production verification

- TypeScript check: passed.
- Unit tests: 310 passed across 31 files.
- Production build: passed.
- Cloudflare deployment: passed.
- Production smoke test: passed.
- Full current-day European source reconciliation: passed.

## 2. OddsPapi account and bookmaker coverage

Live production account response:
- Status: active.
- Request limit: 250.
- Request count: 0.
- Remaining: 250.
- Server-side pilot token: configured.
- Secrets are not returned by the status endpoint.

Belgium-specific bookmaker feeds entitled by the account:
1. Bwin Belgium — `bwin.be`
2. Unibet Belgium — `unibet.be`
3. Betcenter Belgium — `betcenter.be`
4. Bingoal Belgium — `bingoal.be`
5. betFIRST Belgium — `betfirst.be`
6. Golden Palace Sports Belgium — `goldenpalacesports.be`
7. Starcasino Belgium — `starcasino.be`
8. Scooore Belgium — `scooore.be`
9. Napoleon Sports Belgium — `napoleonsports.be`

Separate international comparison feeds:
- `unibet`
- `ladbrokes`
- `bet365`
- `pinnacle`

An entitlement means the account may request that feed; it does not guarantee a price for every fixture. The app must continue to verify the actual quote, bookmaker active/suspended state, price and timestamp per match.

## 3. Active odds flow and request budget

The production app is connected to the OddsPapi daily flow:
1. Read the account's available bookmaker entitlements.
2. Fetch the date's fixtures in one bulk request.
3. Batch odds by tournament and selected bookmakers in one bulk request.
4. Match provider fixtures to local fixtures by normalized home/away names, Brussels date and kickoff time.
5. Store bookmaker-specific 1X2 prices with per-price timestamps.
6. Keep odds pricing independent from prediction eligibility.

Each morning/afternoon slot uses two billable calls (fixtures + odds-by-tournaments). The app has separate idempotent morning and afternoon slots and refreshes its scan every 15 minutes while open. Two slots per day therefore use approximately four billable calls per day. StrikerAPI remains a separate optional source, limited to one attempt per date.

The `/v4/account` endpoint is unmetered but has a 1-second cooldown. Worker account caching is now 300 seconds, with retry delay of at least 2.1 seconds. This prevents repeated status checks from needlessly hitting the provider.

**Important:** the live account still reports 0 requests used. The account connection is verified, but no real odds-by-tournaments import has yet been triggered from the user's Android-local app session. The local pilot token must be saved in the app and must never be pasted into chat.

## 4. Market support and freshness

The documented OddsPapi 1X2 market is market ID 101 with outcomes 101 (home), 102 (draw) and 103 (away). The parser requires all three prices and their individual timestamps before treating the 1X2 snapshot as complete and timestamp-verified. The snapshot timestamp is governed by the oldest of the three price updates.

The public documentation does not confirm a Double Chance market ID/outcome mapping. The market-catalogue endpoint is billable and has not yet been queried. Therefore:
- DC predictions remain a separate model output.
- DC odds are not inferred from 1X2.
- No synthetic DC price is stored.
- DC coupons remain unpriced until an actual supported DC feed is verified.

## 5. Live European source reconciliation — 2026-11-19

Generated at 2026-11-19T07:08:52Z.

| Metric | Result |
|---|---:|
| Unique fixtures | 48 |
| Countries/federations | 15 |
| Competitions | 27 |
| Healthy source checks | 9/9 |
| Degraded sources | 0 |
| Source errors | 0 |
| Duplicate canonical keys | 0 |
| Wrong-date fixtures | 0 |
| Non-European fixtures | 0 |

Source coverage:
| Source | Checked / raw data | Accepted fixtures | Errors |
|---|---:|---:|---:|
| OpenMatchday | 61 catalogues | 0 | 0 |
| OpenLigaDB | 35 competitions | 5 | 0 |
| OpenFootball | 33 feeds | 0 | 0 |
| ESPN | 2 scoreboards | 8 | 0 |
| FootyNomad | 118 page matches / 2 pages | 18 | 0 |
| TimezoneFootball | 153 feed matches | 0 | 0 |
| Flashscore | 136 raw matches / 60 competitions | 21 | 0 |
| API-Football Pro | 111 provider fixtures | 21 | 0 |
| PitchAPI | 8 fixtures; 39 free European catalogue leagues | 1 | 0 |

Zero accepted fixtures from OpenMatchday, OpenFootball and TimezoneFootball on this date were not source errors. Flashscore filtered 115 non-European raw matches. The live audit explicitly warns that this snapshot is not proof that every European federation, youth, women's or amateur competition is represented.

## 6. Tracker backup audit — export from 2026-11-18

This is a historical export, not the current Android state:
- 1,086 total records: 232 match rows, 818 prediction rows, 7 coupons, 12 results and 17 scan records.
- 195 canonical fixtures after cross-provider identity reconciliation.
- 1X2: 195/195 fixtures.
- Double Chance: 169/195 fixtures; 26 DC gaps.
- 24 cross-source duplicate groups.
- Seven raw match rows appeared to have no predictions, but their canonical fixture had predictions under another provider ID.
- Seven old coupons, each with three DC legs: 21 legs across only 7 distinct fixtures. The same fixtures were reused across coupons; one appeared in 7 coupons and another in 5.
- All seven coupons were `PAPER_NO_ODDS`; they were not real placed bets.
- Twelve result rows; no duplicate settlement rows found.
- No odds rows, bet rows or bankroll ledger rows in the export. The configured opening bankroll was €91.60; realized P/L cannot be reconstructed without ledger transactions.

The new canonical identity helper is used by market coverage, selected match cards and dashboard diagnostics. Historical rows are not rewritten or deleted.

## 7. Prediction eligibility and no-odds behavior

The seven core sports-evidence areas are separate from market pricing. Missing odds must not remove a match or mark the model's sports evidence as incomplete. A match can retain its 1X2 and DC predictions while its market price is shown as unavailable. It must not be promoted to a priced bet without a real, matched, fresh quote.

A historical example with an 84.16% displayed probability was not a strong candidate because its core evidence audit lacked the required sports evidence. That rejection was not caused merely by missing odds.

## 8. Android/PWA verification

Static production checks:
- Manifest served and declares standalone display mode and portrait orientation.
- Service worker served at `/sw.js`.
- App shell and static assets are cacheable; API data remains network-driven.
- Viewport includes mobile safe-area support.
- Responsive CSS includes mobile breakpoints down to approximately 390 px.

A physical touch/navigation/export/import test on the user's Samsung device has not been performed. CI and PWA source checks are not represented as a physical Android test.

## 9. Remaining acceptance steps

1. Open the app on Android and ensure the pilot token is saved locally; do not send it in chat.
2. Run the morning/afternoon odds sync and verify real 1X2 quotes, event matches and timestamps.
3. If DC pricing is required, perform the separate billable market-catalogue check and implement DC only if the provider exposes a valid mapping.
4. Export a fresh Tracker JSON/CSV after sync.
5. Re-audit 1X2/DC pairs, coupon legs, odds, bankroll, results and history against that export.
6. Perform the physical Android interaction test.

**Overall status: production integration and source audit passed; full user-data acceptance remains in progress until real odds are imported and a fresh Android export is audited.**
