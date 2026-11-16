# MONEYBALL GLOBAL 2.0 — durable project state

Last verified: 2026-11-16 (Europe/Brussels)

This file is the continuity ledger for maintenance work. Read it before changing the same area again. Do not repeat completed diagnostics or overwrite working changes without checking the latest commit and live deployment.

## Production architecture — do not change

- Repository: `damianwalus3-jpg/moneyball-global`
- Default branch: `main`
- Production frontend: existing Cloudflare Worker `moneyball-global`
- Public URL: https://moneyball-global.damianwalus3.workers.dev
- Auth/data source of truth: existing Supabase project `gzgeklcukrclgwbsmbsp`
- Keep this Worker and Supabase project. Do not create another app, migrate to Vercel, or replace the database.
- User requires one shared online database and one app interface; no need to visit Supabase separately for ordinary use.
- Do not delete or rewrite existing matches, predictions, coupons, coupon legs, results, or bankroll transactions.
- Fixed analytical stake is €4. This is virtual tracking, not real-money bet placement.
- Keep all existing market, scan, result settlement, coupon and finance rules.

## Confirmed completed work

### Existing architecture and database
- Supabase Postgres schema and owner-scoped RLS are active.
- Existing RPCs include `moneyball_dashboard_summary`, `moneyball_dashboard_selected_picks`, and `moneyball_coupon_finance_summary`.
- Dashboard reads use scoped RPCs rather than downloading full prediction history.
- Coupon finance summary includes all-history totals and type breakdown.
- Result auto-settlement, coupon settlement, fixed €4 stake rules, three-leg coupon validation, and single coupon bankroll transaction protections have existing migrations.
- Overlapping prediction cron was paused in migration `20261115195133_pause_overlapping_prediction_cron`.
- Existing prediction index: `moneyball_predictions_owner_id_id_idx(owner_id, id)`; it was verified present in production.
- Existing coupon/match indexes were inspected; no speculative schema change was applied.

### Prediction-history timeout investigation (2026-11-16)
- The reported error was PostgreSQL statement timeout on REST reads from `public.predictions`, surfaced as `canceling statement due to statement timeout`.
- Production logs showed 1,000-row UUID-shard requests taking about 18.4–22.7 seconds and returning HTTP 500 for some shards. Other shards completed in 6–16 seconds.
- The table already has the owner/id index. A live `EXPLAIN ANALYZE` under the authenticated role for the same owner-scoped keyset query with LIMIT 250 used `moneyball_predictions_owner_id_id_idx`, returned 250 rows in about 6.3 ms, and read 254 shared buffers. This establishes that small indexed pages are fast; the expensive 1,000-row shard reads were the timeout trigger.
- Commit `49626cda999e6be5f2f926bc3645a2e93f257ff6`: changed page size from 1,000 to 250 and raw table cache TTL from 45 seconds to 120 seconds.
- Commit `3f4fe9300aada55c850c1e400a49d6debe949f68`: removed `predictions` from 30-second live full-table refresh; predictions now use a 120-second stale time and no interval refetch. Explicit invalidation after mutations remains.
- Both changes were fetched back from GitHub main and verified present in source.
- Commit `9149b09085903077615ca33b1b1f9729179dddf7`: bounded concurrent UUID-range reads to at most two ranges at a time and added automatic retry for PostgreSQL `57014` / statement-timeout errors by halving the page size down to 50, resuming from the exact same keyset cursor. This avoids retrying the whole history and prevents skipping/duplicating rows.
- Commit `7716a8f9049d51177fd5322db91476969944660a`: added an explicit null-page guard to the adaptive pagination loop.
- The current implementation still reads all prediction rows across four UUID partitions for several legacy screens. This is a remaining architectural load issue; do not describe the permanent fix as complete until those screens use scoped/paginated reads and the live Worker is verified.

## Deployment state — explicitly not complete yet
- Public Worker homepage was checked and responds with HTTP-accessible MONEYBALL GLOBAL 2.0 content. Its `/panel` route correctly requires login.
- A GitHub commit does not prove production deployment.
- The GitHub status for commit `3f4fe9300aada55c850c1e400a49d6debe949f68` showed Vercel failure due build-rate-limit. Vercel is not the production target; README specifies Cloudflare Worker.
- Browser profile `Cloudflare MONEYBALL deployment` exists but has no recorded Cloudflare sign-in. Do not attempt authenticated Cloudflare dashboard actions until the user confirms the profile is already signed in or signs in through the profile setup flow.
- No successful Cloudflare deployment of the two 2026-11-16 commits has been confirmed.

## Required next steps — do these once, then update this ledger
1. Continue the durable fix: stop full-table prediction reads on the history, results, coupon, match, prediction, statistics and settlement views. Use scoped queries/RPCs and cursor pagination; retain complete historical data and finance totals. Ensure coupon-leg lookups fetch only referenced prediction IDs where possible.
2. Keep queries owner-scoped under RLS. Never put service-role secrets in browser code.
3. Run typecheck, unit tests and production build using the repo's Bun scripts from README; inspect failures rather than bypassing them.
4. Deploy to the existing Cloudflare Worker `moneyball-global`, not Vercel.
5. Verify the exact production build by checking the Worker deployment and authenticated app routes; test History, Matches, Coupons, Results, Statistics, €4 settlement and net profit/loss.
6. Check fresh Supabase logs after deployment. Require zero prediction-table statement-timeout errors during navigation and verify normal response latency across repeated visits.
7. Run TypeScript/build checks before deployment; the 2026-11-16 adaptive pagination commits have not yet had a confirmed CI/build result.
8. Only then mark the fix complete here. Record every commit, migration, test, deployment version and measured result so later sessions do not repeat work.

## User's operating constraints
- Work directly on the existing app; no rebuild from scratch.
- Preserve all previously implemented functions and historical data.
- Avoid asking the user to repeat project decisions already recorded.
- Do not claim a fix is deployed or permanent based only on a GitHub commit.
- Do not circle back to completed diagnostics; consult this file and the latest source first.


## External benchmark review — Scorevance (2026-11-16)

Scorevance was selected as a product/UX and prediction-quality benchmark. Its public Google Play listing describes pre-match 1X2 probabilities, O2.5, BTTS, U3.5, confidence bands, explanations, last-five form, H2H, confirmed lineups, injuries/suspensions, xG, market-odds calibration, and live re-rating. Its public accuracy page says it scores only pre-match forecasts, one forecast per match, after verified final results, and reports hit rate alongside Brier score and sample sizes. Its figures are self-reported and not independently audited; do not treat them as guaranteed future betting performance.

Reference URLs:
- Google Play: https://play.google.com/store/apps/details?id=co.uk.tobistech.Scorevance
- Methodology/accuracy: https://scorevance.tobistech.co.uk/accuracy

### MONEYBALL comparison from current source review
- Already present: 1X2 model, Double Chance derived from 1X2, separate Poisson goals model, historical xG when eligible coverage exists, explicit missing-data reporting, prediction rationale, fixed €4 virtual stake, coupon settlement, and binary Brier/Log Loss diagnostics.
- Important gap: README confirms ESPN roster data is not a confirmed matchday lineup; confirmed starting XIs and injuries cannot be assumed available. Keep them explicitly unavailable unless a trustworthy feed actually supplies them.
- Important calibration gap: current UI's Brier/Log Loss diagnostics are binary per selected event, not a full three-class 1X2 Brier score. Add multiclass 1X2 calibration and reliability buckets before claiming comparable model calibration.
- Important confidence gap: the current 0–100 data coverage score is a coverage heuristic, not probability confidence. Do not label it as confidence or use it as a substitute for calibrated probability.
- Important UX gap: predictions should be clearly separated into upcoming/pre-match, live, and finished/settled; only upcoming matches may enter pre-match coupons. Show kickoff time and data freshness.
- Important performance gap: legacy screens and coupon joins still trigger full prediction-history reads; continue scoped queries and keyset pagination before claiming navigation performance is fixed.

### Implementation order
1. Preserve the existing MONEYBALL engine and database. Do not copy Scorevance code, scrape private endpoints, or depend on an undocumented API.
2. Add full multiclass 1X2 Brier score, log loss, calibration buckets/reliability reporting, with verified settled pre-match samples and sample-size warnings.
3. Separate true model confidence from data coverage; do not create confidence labels from the coverage heuristic.
4. Make the pre-match feed date-scoped and exclude live/finished/postponed matches from coupon candidate selection.
5. Add confirmed lineup/injury inputs only if a reliable accessible source exists; otherwise show unavailable and explain the limitation.
6. Continue the pending scoped-query performance work, run tests/build, deploy to the existing Cloudflare Worker, and verify production end-to-end before marking complete.


## Implementation started — Scorevance-inspired quality and correctness changes (2026-11-16)

Changes committed to `main`:
- `56b8a105c4f03351d7eb0e046a9df152c8b05416` — added `multiclass1X2Quality`: full three-class Brier and Log Loss, accepting only complete 1/X/2 triplets for the same match, all three verified and settled, exactly one winning class, and probability sum within 1 percentage point of 100. Incomplete/contradictory rows are excluded.
- `67c11203302e57c3e656aeb9f11868b97f09fca5` — added unit tests for correct scoring, incomplete/unverified/contradictory/non-normalized samples, and market isolation.
- `4682c3cecfa0e3e0002c45f5540b73b2ef131a0a` — added a dedicated full multiclass 1X2 score panel to Statistics; the existing per-selection binary diagnostics remain clearly separate.
- `32d096db294c29908357f802af81b4bb05ea09c5` — stopped writing data-coverage percentage into the `confidence` field in the prediction Edge Function. Until a reproducible out-of-sample calibration supports confidence bands, this field is now null; data coverage remains separately recorded.

Validation and deployment status:
- Changes are committed and source has been written to GitHub main.
- No successful GitHub Actions run is visible for the latest commit in the available workflow/status lookup. The only reported commit status is the existing Vercel build-rate-limit failure; Vercel is not the production host. Therefore tests, typecheck and production build are NOT yet confirmed.
- No Cloudflare or Supabase Edge Function deployment has been confirmed for these changes. The existing Cloudflare deployment profile has no saved Cloudflare sign-in, so authenticated deployment cannot safely proceed until the user signs in through the browser profile setup. Do not claim production has these changes.
- Next: validate the implementation with CI/build, then deploy the frontend to Worker `moneyball-global` and the changed `moneyball-predict` function to the existing Supabase project using the authorized deployment route; finally verify both production surfaces and the Statistics screen.
- Remaining planned work: scoped prediction reads and fast navigation; explicit pre-match/LIVE/finished presentation; reliable confirmed-lineup/injury sources only when genuinely available; broader end-to-end test of €4 settlement and bankroll P/L. No historical rows were deleted or rewritten.


### Additional performance change
- `0c97b308ff6e98589686782b5377c6b444f6d53a` — added a strict undefined guard for the winning 1X2 class under TypeScript `noUncheckedIndexedAccess`.
- `93a1f3d678042893791d2655bff6fae431e4cd6a` — coupon-leg, coupon and odds-snapshot joins now fetch only prediction IDs referenced by those rows (owner-scoped, batched in groups of 100) instead of downloading the entire predictions table for each join. This reduces redundant full-history reads but does NOT yet eliminate full-history reads from legacy pages that call `useTable("predictions")`.
- A fresh GitHub code search identified remaining full-table consumers: History, Results, Coupons, Statistics, Matches, PredictionsView and SettleMatchDialog; the scan import path also reads all predictions for deduplication. These remain the next performance workstream and must be converted to scoped/paginated access without losing the full historical record.
- The repository CI workflow is configured on pushes to main to run Bun tests, Deno Edge Function type checks, TypeScript and production build. The available status endpoint still reports only the Vercel build-rate-limit failure and no successful GitHub Actions run; validation remains unconfirmed.


## Production deployment and CI confirmation — 2026-11-16

- Latest source commit included in the release: `9af04a671986338d03e103ee3713813d5d296c24`.
- GitHub Actions Moneyball CI run `#688` for that commit completed the full validation sequence successfully: Supabase Edge Function Deno checks, Bun tests, TypeScript type-check and production build. The immediately preceding commit's run `#687` also completed all test/typecheck/build steps successfully.
- Cloudflare production deployment workflow run `#291` for commit `9af04a6` completed successfully. The job shows tests, typecheck, Cloudflare build and `Deploy to Cloudflare Workers` all succeeded.
- Production Worker checked after deployment: https://moneyball-global.damianwalus3.workers.dev/ — responds with the MONEYBALL GLOBAL 2.0 application page and existing €4 analytical stake description.
- Supabase Edge Function `moneyball-predict` was deployed directly to project `gzgeklcukrclgwbsmbsp`, version `210`, status ACTIVE, `verify_jwt=true`. This deploy includes the correction that keeps data coverage separate from confidence. Function source checksum reported by Supabase: `40b2e6419048a4e85c1cd430b5b306fb451dd7ab89f2e73969af1fbfa9ee9c7a`.
- The new full multiclass 1X2 Brier/Log Loss implementation and tests passed CI (45 tests passed in the successful validation run before the last small DB join change; the latest CI run for commit 9af04a6 also completed all test/typecheck/build steps successfully).
- Remaining verification limitation: public Worker homepage is verified, but the authenticated Statistics page and the full user journey (login, history, coupons, results, €4 P/L) have not yet been exercised with the user's signed-in session. Do not mark end-to-end verification complete until those screens are checked in an authenticated session.
- Remaining performance work: legacy pages still invoke `useTable("predictions")` and fetch full history. The coupon/odds joins are now ID-scoped, but full-history consumers in History, Results, Coupons, Statistics, Matches, PredictionsView, SettleMatchDialog and scan import still need a scoped/paginated refactor. This is not yet a claim that every menu is fast.


## Odds-source audit and recovery plan — 2026-11-16

User reports losing valid predictions because bookmaker prices cannot be confirmed. Treat this as an odds-coverage/matching problem, not a reason to weaken model thresholds or fabricate prices.

### Existing live infrastructure
- Active Supabase Edge Function `moneyball-movi-odds-sync`, version 6, reads today's Brussels-local matches, matches them to the MoviOdds soccer catalog, requests fixture snapshots and stores quotes in `provider_odds`.
- Its deployed code is MoviOdds / bet365 only. It maps 1X2, Double Chance, BTTS and goal totals; suspended/invalid prices are excluded. It only covers fixtures present in both catalogs and markets currently priced by bet365.
- It expects secret `MOVIODDS_API_KEY`. The GET health response reports whether the key is configured. Key state and recent successful sync metrics were NOT verified in this audit.
- Other active odds-related Edge Functions exist: `api-football-sync`, `bwin-odds-probe`, `kambi-odds-probe`. Inspect their deployed code and actual quote coverage before creating another adapter. Some deployed probe sources are not present at the checked paths in GitHub; Supabase deployed source is authoritative until reconciled into the repo.

### External provider comparison
- OddFeeds claims 60+ bookmakers, full football, pre-match/in-play, 1–3 second push, opening/movement/closing prices and free trial. Public price: €500 per bookmaker feed/month, €250 setup/feed, minimum 5 feeds; pre-match and in-play are separate feeds. Technically strong but too expensive for current needs unless free trial proves value and user later approves cost. https://oddfeeds.com/
- API-Football/API-Sports documents pre-match odds 1–14 days before kickoff, 3-hour updates, 7-day odds history, with availability varying by league/fixture/bookmaker. Potential supplementary feed, not sole final-price validator. https://www.api-football.com/documentation-v3
- The Odds API is a candidate aggregator for a controlled test, but exact availability for Belgian-licensed Bwin BE, Unibet BE, Ladbrokes BE, Circus and betFIRST must be proven on real fixtures. Global bookmaker presence does not prove Belgian jurisdiction availability. https://the-odds-api.com/
- betspread's own developer portal currently states 0 product-verified bookmakers across REST/live while sources remain under review; do not use in production yet. https://betspread.io/docs
- ParlayAPI publishes a Unibet (BE) feed/coverage page; useful candidate for a narrow Belgian fallback, but event-level coverage must be tested before integration. https://api.parlay-api.com/books/unibet_be
- Scorevance is a prediction app benchmark, not a verified odds-feed provider.

### Decision and implementation rules
1. Keep MoviOdds/bet365 as existing source; verify key configuration, latest sync, matched-fixture ratio, saved quotes, freshness and errors first.
2. Inspect existing Bwin, Kambi and API-Football deployed probes before coding a new provider. Reconcile useful deployed source into GitHub and test it.
3. Compare The Odds API and/or ParlayAPI against a fixed sample of real MONEYBALL fixtures from Belgium's top two tiers and major European leagues. Measure fixture match rate, market match rate, Belgian-bookmaker match rate, freshness, suspended/stale rates and failures.
4. Prioritize directly confirmed Belgian bookmaker quotes. If only another jurisdiction's quote exists, label it reference-market only, never as a Belgian price.
5. Never delete/hide a model prediction just because an odds provider lacks a quote. Keep it visible with odds status `MISSING`, `STALE`, `SUSPENDED` or `CONFIRMED`; coupon eligibility can still require a fresh confirmed quote.
6. Store provider, bookmaker, decimal price, market/outcome, source timestamp, retrieval timestamp, fixture-match confidence and freshness. Deduplicate by canonical match + provider + bookmaker + market + outcome and retain history for audit.
7. Refresh prices on a sensible cadence (e.g. 15 minutes, then more frequently near kickoff if provider limits permit); always fetch a fresh quote before coupon-ready status. Reject stale/suspended prices.
8. No paid subscription or new phone app is authorized by this audit. Do not add a paid dependency or ask the user to install an app until coverage and cost are measured.

### Still outstanding
- No new odds-source code has been committed or deployed in this audit.
- MoviOdds key configuration, live sync metrics, actual quote coverage, and Bwin/Kambi/API-Football deployed implementations remain unverified.
- Next: inspect Supabase logs and deployed source, then run fixture-level coverage comparison before selecting a secondary feed.


### Production log findings from the same audit
- Supabase logs show `moneyball-movi-odds-sync` is being called automatically, not merely sitting idle.
- In the last 24h log window, the function had multiple POST HTTP 200 syncs (some taking about 12–74 seconds, one up to ~107 seconds) and repeated POST HTTP 500 failures (roughly 1–5 seconds). There were also GET health checks returning 200.
- This confirms the current single-provider sync is intermittent and slow; it is a concrete likely contributor to missing/unconfirmed prices. The log query did not expose the JSON response body for each failed POST, so the precise 500 cause is not yet proven. Do not guess whether it is auth, MoviOdds, catalog, or database until inspecting invocation response/diagnostic logs.
- Next fix should make the sync resilient and observable: per-match errors instead of failing the entire run, bounded batches/timeouts, and a persisted sync summary with counts for app matches, matched fixtures, snapshot successes, saved quotes, stale/suspended quotes, and provider errors. Add an independent fallback source only after the current failure mode and actual fixture coverage are measured.


### Deeper production audit — 2026-11-16 (continued)
- Supabase public health GET for `moneyball-movi-odds-sync` returned `key_configured:false`.
- Direct no-credential probes of MoviOdds `/catalog?sport=soccer`, `/snapshot?fi=202407630`, and documented `/odds?sport=soccer&groups=40` returned HTTP 401 in the probe environment. Therefore the active sync currently cannot access the feed without a valid credential; do not rely on the documentation's generic mention of optional keys as proof of anonymous endpoint access.
- Production DB inventory: `provider_odds` has 219,022 rows, all MoviOdds/bet365, across 286 matches; newest quote is 2026-11-16 02:11:13 UTC. The latest stored quotes are now old and cannot be presented as current.
- `odds_snapshots`, which the existing UI/schema adapter reads, has only 8 rows, newest 2026-11-13 07:15 UTC. This is a major storage/UI integration gap: the main provider feed is stored in `provider_odds`, while legacy screens still query `odds_snapshots`.
- On 2026-11-16, there were 284 pending predictions for today's fixtures; 110 had a non-null prediction-level odds value and 174 had no odds. This is not proof all 174 can be priced: the current provider quote sample is stale.
- Across the full history, a SQL join on match + mapped market + mapped selection finds 5,115 provider quote / prediction pairs, demonstrating that mapping exists for some selections. However, a 6-hour freshness filter found zero pairs at audit time. Freshness is therefore a hard blocker even where historic matching worked.
- Current provider quote mapping has 1X2 and Double Chance mappings, plus GOALS mappings. Some provider goal lines are Asian quarter/whole lines (e.g. OVER_2.25, OVER_2.75) and do not map to the app's discrete selections; do not coerce those into a different market line.
- Existing MoviOdds code sends requests even when key is empty, then fails upstream; the function does not stop early with an actionable configuration error. Add explicit configuration diagnostics and per-match error reporting when repairing it.
- The deployed Bwin and Kambi probe functions are stubs returning HTTP 404. API-Football sync is a fixture/results importer, not an odds provider.

### Current provider decision
- Keep MoviOdds/bet365 as a potential primary source only after a valid credential is configured and live quote freshness is proven. Its current production feed is not healthy.
- The Odds API is a credible second-source candidate: its public Belgian Pro League page says current/upcoming odds are included even on the free usage plan, with 1X2/handicap/over-under markets. Actual bookmaker list and other league coverage still require key-backed event-level validation. https://the-odds-api.com/sports/belgium-pro-league-odds.html
- ParlayAPI's Unibet BE public coverage page shows Belgian first division with moneyline and h2h, but its EU regions page explicitly lists some bookmakers as unavailable/not integrated; it does not establish broad Belgian market coverage or 1X2 draw/Double Chance/BTTS support. Treat as narrow candidate only. https://api.parlay-api.com/books/unibet_be and https://api.parlay-api.com/regions
- MoviOdds documentation currently advertises a free key and describes a key as optional on some endpoints, but live unauthenticated probes in this environment returned HTTP 401. Operational behavior takes precedence over marketing/docs until tested with a valid key. https://moviodds.com/doc
- No provider was newly integrated and no odds data was overwritten. No current price should be inferred from the old 219k rows.

### Next required engineering work
1. Reconcile data model: expose provider_odds to the application via a typed read adapter/query or a safe DB view/RPC; do not simply copy all 219k rows into odds_snapshots.
2. Implement market/selection matching for prediction rows and choose the latest fresh, unsuspended quote. Store bookmaker/provider/source timestamps. Keep missing/stale status explicit and retain predictions regardless.
3. Add source freshness diagnostics and sync health counters; stop treating a 200 function response as proof that quote coverage is complete.
4. Restore a valid MoviOdds credential or choose a verified accessible source. For The Odds API, a user-managed API key is required for reliable event-level tests; do not request it in chat or store it in source code. Provide a secure Supabase secret configuration path only if the user chooses that provider.
5. After a fresh source is available, run a side-by-side test on the same current European fixtures and only then enable fallback selection / coupon-ready status.
