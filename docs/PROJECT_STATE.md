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


### Live unauthenticated provider probe — 2026-11-16
- Public GET health response: `key_configured:false`.
- TinyFish direct HTTP probes without credentials returned HTTP 401 for MoviOdds `/catalog?sport=soccer`, `/snapshot?fi=202407630`, and `/odds?sport=soccer&groups=40`. Thus the current feed is inaccessible without a valid key in the tested production path. Do not claim the key is optional operationally just because documentation mentions keyless limits.
- MoviOdds published pricing page advertises a free $0 API key and paid tiers from $39/month; documentation says keys can be created from account page. This is a no-subscription route if user elects to restore access, but requires a credential stored securely as Supabase secret `MOVIODDS_API_KEY`. Never ask the user to paste it in chat. https://moviodds.com/pricing/ and https://moviodds.com/doc
- The Odds API's Belgian Pro League page explicitly says current/upcoming odds are covered and available on its free plan. This is the best candidate to test as a second provider, but a free API key and real event-level bookmaker/market response are still required. https://the-odds-api.com/sports/belgium-pro-league-odds.html
- ParlayAPI's Unibet BE page shows Belgium first-division soccer moneyline/h2h rows, while its regions page reports several other Belgian/European brands as unavailable/not integrated. It is not a broad all-market fallback. https://api.parlay-api.com/books/unibet_be and https://api.parlay-api.com/regions
- Corrected earlier preliminary assumption: MoviOdds key absence is confirmed by health response and tested endpoint 401s, but logs alone did not prove every historical POST 500 had the same root cause.

### Exact production coverage finding
- Latest quote time 2026-11-16 02:11:13 UTC; no provider_odds row is fresh within six hours at audit time.
- 284 predictions exist for today's fixtures; 110 have odds on the prediction record and 174 have null odds.
- 219,022 rows in provider_odds vs only 8 in odds_snapshots (the table the legacy app adapter currently reads). This strongly indicates the odds feed and app display/storage model are disconnected.
- A historical join of provider_odds to predictions by match_id + mapped_market + mapped_selection finds 5,115 pairs without a freshness restriction. Therefore there is existing recoverable historic mapping logic, but no currently fresh pair in the six-hour window.
- Latest DB queries were read-only; no production data was modified.


## Expanded production and provider audit — 2026-11-16 (continued)

### Live provider health checks
Unauthenticated GET health endpoints were checked directly against the deployed Supabase Edge Functions:
- `strikerapi-sync`: `configured:true`. The deployed implementation calls StrikerAPI `get_schedule` for eight hardcoded league keys (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Championship, Eredivisie). It requests `days:30`, not a Brussels-local single-day fixture list. It stores implied market probabilities and bookmaker metadata in `match_market_data`; it does not write canonical quote rows into `provider_odds` or `odds_snapshots`. Its sync can therefore expand the match set beyond the user's Europe/today/first-two-tiers constraints unless caller-side filters are enforced.
- `pitchapi-sync`: `configured:false`. Its code supports a 77-league enrichment workflow with last-five form, xG, H2H and lineups, but it cannot call the provider until `PITCHAPI_API_KEY` is configured. It has conservative team-name matching (score >=0.82 and >=0.08 separation) and cache TTLs; keep predicted lineups distinct from confirmed lineups.
- `moneyball-movi-odds-sync`: `key_configured:false`; MoviOdds/bet365 is not currently authenticated in production.
- `bwin-odds-probe` and `kambi-odds-probe`: deployed source is a static HTTP 404 handler. They are not usable odds integrations.
- `api-football-sync`: configured secret is not publicly exposed by health; deployed code requires `API_FOOTBALL_KEY`. It imports fixtures and results for a fixed set of 11 competition IDs. Its manual result path updates pending prediction rows directly and must not be used as a replacement for the canonical settlement pipeline unless coupon legs and bankroll transactions are also reconciled.

### Fresh database snapshot
At the time of the live query on 2026-11-16:
- `provider_odds`: 219,022 rows; 16,238 mapped to canonical market/selection; newest quote 2026-11-16 02:11:13.758 UTC; zero rows fresh within six hours.
- Provider/bookmaker split: all rows are MoviOdds / bet365. 136,774 prematch and 82,248 in-play rows; zero fresh within six hours in either phase.
- `odds_snapshots`: 8 rows; newest 2026-11-13 07:15:05 UTC; zero fresh within six hours.
- Current Brussels-local day prediction count: 252, with 142 rows having null odds.
- `provider_odds` has indexes on (match_id, market_name, captured_at DESC), provider_fixture_id and fresh non-suspended captured_at, so a freshness-filtered indexed read path is feasible. Do not bulk-copy the historical table into `odds_snapshots`.

### External product and source benchmark
- Scorevance publishes pre-match-only resolved forecasts, sample sizes, monthly and competition splits, Brier score and confidence-band calibration. Its public accuracy page reports publisher-self-reported results, not an independent audit. Use the transparency/reporting pattern, not its headline hit rate as a target or guarantee. https://scorevance.tobistech.co.uk/accuracy
- ScoreProb also publishes pre-kickoff prediction counts, a base-rate comparison, calibration error and Brier score. Its reported figures are self-published and must be treated as such. https://scoreprob.com/model-performance
- Footlab AI describes a bivariate Poisson goal model combining weighted form, Elo, lineups/absences, home advantage, context and market calibration. This is a useful design reference, not evidence that its claimed performance will transfer to MONEYBALL. https://footlab.ai/en/methodology
- Sofascore is useful for detailed match-level live stats and visualizations; FotMob for fast mobile match pages, lineups and xG in selected leagues; Flashscore for broad fixture/result coverage. These are corroboration/research websites, not approved scraping APIs. Respect terms and avoid undocumented/private endpoints.
- Understat and FBref are useful for historical advanced metrics in supported competitions; do not assume full coverage of lower leagues.
- FootballAPIs' October/November 2026 comparison lists API-Football, Sportmonks, Highlightly and others with differing free plans, league coverage and odds/lineup/xG availability. Its table is a third-party comparison, so confirm provider-specific plan details before relying on it. https://footballapis.com/compare/
- The Odds API's public page advertises a free tier of 500 credits/month, coverage of 100+ bookmakers, and EU bookmakers including Unibet, Pinnacle and Betfair. It does not establish that Belgian-licensed Bwin, Unibet BE, Ladbrokes BE, Circus or betFIRST prices are available for our specific fixtures. A live event-level test with a key is still required. https://the-odds-api.com/

### Engineering conclusions and next safe changes
1. The odds ingestion and UI schema are disconnected: sync writes `provider_odds`, while the typed app adapter currently exposes `odds_snapshots`. Build a read-only, owner-scoped, freshness-aware provider-odds adapter/RPC; do not duplicate the historical provider table.
2. Resolve provider quotes to predictions only by exact canonical match_id + mapped_market + mapped_selection; require unsuspended prematch quotes and an explicit freshness threshold. Never use a stale quote as current or use in-play prices for a prematch coupon.
3. Preserve every prediction if odds are absent. Add explicit MISSING / STALE / SUSPENDED / CONFIRMED quote status; coupon eligibility requires fresh confirmed odds but the model record stays visible.
4. The current StrikerAPI sync's 30-day schedule request is broader than the strict daily scope. Fix date filtering and league selection before it can be considered a compliant primary fixture import. Do not let it create fixtures outside today's Europe/Brussels date or outside the configured major + first/second-tier leagues.
5. Do not activate PitchAPI or a new odds vendor by inventing credentials. A provider key must be created by the user and entered as a Supabase Edge Function secret; never paste it into chat or browser code.
6. Do not use the current API-Football sync's direct prediction settlement as the authoritative settlement route without reconciling coupon legs and bankroll ledger. Prefer the existing canonical result/coupon settlement functions.
7. Next validation: use a fixed sample of actual today's eligible fixtures; measure provider fixture match rate, market/outcome match rate, bookmaker jurisdiction, quote age, suspended share, error rate and request/credit cost. Only then choose a secondary provider.
8. No production code or data was modified by this audit pass. The checks above were read-only; production remains in its previously recorded deployment state.


### Additional live-data audit — 2026-11-16 13:xx UTC
A follow-up read-only query shows the application does have fresh non-odds enrichment data:
- `match_market_data` source `MONEYBALL_PUBLIC_AGGREGATOR`: 1,858 rows, latest 2026-11-16 13:14:54 UTC, 9 within the last six hours.
- `FootyNomad`: 136 rows, latest 13:17:44 UTC, 9 within six hours.
- `StrikerAPI`: 57 rows, latest 2026-11-10 11:54:17 UTC, none within six hours.
- Recent sample payloads show the public aggregator is currently providing ESPN-derived last-five form and match statistics; it is not a current bookmaker price feed. FootyNomad rows likewise contain team form. Do not count these as odds or xG unless the actual payload field supports that interpretation.
- Brussels-local fixture status query: 25 scheduled, 3 live, 3 postponed for the current day at audit time. The current feed must not treat postponed or live matches as pre-match coupon candidates.

### Updated provider selection
- Keep FootyNomad as the canonical fixture/list source per project requirements, and use fresh public aggregator/ESPN-derived form as a corroborating enrichment source where the data is match-specific and timestamped.
- StrikerAPI is configured but its production match-market-data rows are stale since 2026-11-10; the sync code's 30-day schedule window and eight-league hardcoding also conflict with the app's strict daily/Europe/league-scope requirements. It should not be allowed to widen today's match list.
- PitchAPI's code is potentially useful for xG/H2H/lineup enrichment, but the production health endpoint explicitly reports no key. Do not label its data as active.
- MoviOdds is not authenticated; current odds rows are stale. The Odds API's free public tier is 500 credits/month and lists selected EU bookmakers (including Unibet, Pinnacle and Betfair), but Belgian bookmaker/jurisdiction coverage remains unverified. Do not integrate it as a Belgian price source without a real-fixture test.

### Audit ledger commit
- `42d529e1597195054a43f3c0d3b4b84d10ad581d` — expanded provider, source, and production findings recorded in this file. Documentation-only commit; no production code, migrations, or data were changed in that commit.


## Google Play and bookmaker odds-ingestion benchmark — 2026-11-16

### Apps reviewed (public Play Store descriptions)
- OddsMax (Google Play): advertises real-time comparison across 40+ bookmakers, multiple market types, accumulators and price-change updates. The listing does not disclose the upstream provider/API, bookmaker-by-bookmaker Belgian coverage, or a reproducible technical ingestion method. Treat it as a UX/product benchmark, not evidence of a reusable API. https://play.google.com/store/apps/details?id=com.oddsmax.app
- OddScore (Google Play): focuses on odds movement, implied-probability changes, consensus and gaps between bookmakers, with 1X2 and O/U depending on competition. Its listing does not identify its upstream feed. Useful benchmark for storing timestamped price history and displaying movement, not a source to scrape blindly. https://play.google.com/store/apps/details?id=io.oddscore.app
- BetSport AI (Google Play): listing describes five-bookmaker comparison for the same match/market, bookmaker margin calculation, line movement and multiple bet builder; free tier delayed, VIP real-time. It does not publish the underlying feed/API in the listing. Useful design benchmark: compare like-for-like markets, compute overround, show freshness and distinguish delayed from real-time. https://play.google.com/store/apps/details?id=com.betsportai.app
- PureStats (Google Play): describes fair odds vs model odds, closing-line value (CLV), ROI and forward-tested league expansion. Useful benchmark for CLV/ROI tracking and transparent validation; listing does not disclose an odds ingestion API. https://play.google.com/store/apps/details?id=com.purestats.app
- Odds Comparison (Google Play): generic all-bookmaker comparison listing; no upstream data method or Belgian bookmaker-level guarantees disclosed. https://play.google.com/store/apps/details?id=com.oddscompare.app
- Soccer Odds (Google Play): claims odds tracking from legal sportsbooks and alerts; provider/API is not disclosed in its public listing. https://play.google.com/store/apps/details?id=com.soccerodds.app

### Bookmaker / aggregator feed findings
- The Odds API V4 documents a normal server-side REST pull: discover sports, request `/v4/sports/{sport}/odds` with region and market, receive event/bookmaker/market/outcome price objects, poll according to the provider's update cadence and credit budget. This is the cleanest documented multi-bookmaker adapter candidate. https://the-odds-api.com/liveapi/guides/v4/
- Its currently published EU book list includes 1xBet, 888sport, Betfair Exchange, Betsson, BetVictor, Coolbet, Marathonbet, Matchbook, NordicBet, Pinnacle, Tipico, Unibet France/Netherlands/Sweden, William Hill and Winamax France/Germany. The list does NOT currently establish Belgian-licensed Bwin BE, Unibet BE, Ladbrokes BE, Circus or betFIRST availability. Do not silently substitute a different jurisdiction's bookmaker as a Belgian quote. https://the-odds-api.com/sports-odds-data/bookmaker-apis.html
- The Odds API says its odds endpoint is near-real-time, with documented maximum latency of 2 minutes pre-match and 40 seconds in-play. This must be treated as vendor-stated latency, not independently measured MONEYBALL latency. https://the-odds-api.com/sports-odds-data/bets-api
- API-Football official docs: pre-match odds are available 1–14 days before kickoff, refreshed every 3 hours, with 7-day history; availability varies by league, season, fixture and bookmaker. In-play odds refresh 5–60 seconds and are removed after matches finish. This is a possible complementary feed but too slow for a strict real-time best-price display and still requires an API key. https://www.api-football.com/documentation-v3
- bet365 does not publish a general public odds API; third-party relays such as MoviOdds are the supported practical pattern when properly licensed/authorized. Do not copy undocumented mobile-app/private bookmaker endpoints, bypass anti-bot controls, reuse app session tokens, or scrape logged-in accounts. Such methods are fragile, may violate terms, and cannot be treated as stable provider integrations. MoviOdds public comparison: https://moviodds.com/bet365-odds-api-providers/

### Reusable methods to adopt (not proprietary code or private endpoints)
1. Multi-bookmaker fan-out behind one server-side provider interface; no API keys in browser/mobile code.
2. Pull sports/competitions once and cache provider metadata; poll only eligible current-day fixtures, batch requests and respect quotas.
3. Normalize provider event identity by home/away, competition, gender and kickoff; require strict match confidence and prevent one provider fixture from binding to multiple app fixtures.
4. Normalize markets/outcomes into canonical keys (1X2, DC, BTTS, O/U with exact line); never merge different handicap lines or market types.
5. Persist every price observation with provider, bookmaker, region/jurisdiction, event ID, market/outcome, decimal price, source timestamp, retrieval timestamp, suspended/live flag and raw payload.
6. Maintain append-only history for line movement/CLV; update latest quote separately. Compute bookmaker overround only from a complete mutually exclusive market set, and remove vig before comparing fair probabilities.
7. UI must label quote freshness (live/delayed/stale/missing), provider and jurisdiction; never show a delayed/old quote as live.
8. Predictions remain recorded without odds. Coupon eligibility requires a fresh, unsuspended, pre-match price from an approved bookmaker/jurisdiction.
9. Health metrics: provider request success, quota/credits, fixture match rate, market mapping rate, quote age percentiles, bookmaker coverage and missing-price ratio.

### Decision and blocker
The best safe next technical candidate is a provider adapter for The Odds API, tested side-by-side against MoviOdds on the exact same current-day eligible fixtures. However, its published EU bookmaker list does not demonstrate Belgian licensed bookmaker coverage, and its endpoint requires an API key. The Play Store listings do not reveal their private data vendors or endpoint methods. No legitimate technical basis exists to clone their undisclosed internal scraper or API. We can reproduce the public, documented architecture and UX patterns instead.
No new odds provider was activated in this audit; no key was supplied and no real fixture-level authenticated test was possible. No new app code or production data was changed in this research pass.


## Provider-odds hardening deployment — 2026-11-16

### Implemented in production database
- Applied and recorded Supabase migration `20261116134409_harden_provider_odds_prediction_sync`.
- Hardened both active provider-odds trigger functions (`apply_provider_odds_to_matching_predictions` and legacy `apply_provider_odds_to_predictions`):
  - reconcile only exact owner + match + canonical market + canonical selection;
  - use only unsuspended prematch quotes with decimal odds > 1;
  - require captured_at within the last six hours and reject future timestamps beyond two minutes;
  - select the newest valid quote deterministically by captured_at, provider price timestamp, and row ID;
  - do not overwrite manually entered prices or Bwin-labelled prices;
  - mark automated quote metadata as CONFIRMED, STALE or SUSPENDED;
  - clear the automated price only when its own provider quote is no longer eligible, retaining the prediction row.
- Restricted EXECUTE on both trigger functions to service_role; authenticated and anon cannot call the SECURITY DEFINER trigger functions directly.
- Existing provider table RLS remains owner-scoped.

### Verified database behavior
- Ran a controlled integration test against one existing pending prediction: inserted a temporary test quote (2.01), verified the trigger updated the exact matching prediction, deleted the temporary quote, and restored the original prediction fields.
- Follow-up query confirmed zero leftover `MONEYBALL_TRIGGER_TEST` rows.
- Confirmed both provider_odds triggers are present and the active trigger function body contains owner, match, market, selection, freshness, prematch and suspension checks.
- Current live data still contains zero fresh mapped unsuspended prematch provider quotes within six hours. Today's prediction count remains 252, with 142 null odds and zero CONFIRMED quotes. The new guardrails do not manufacture prices; the feed remains blocked by the missing MoviOdds credential.
- Supabase advisors after migration: no new warning attributed to these trigger functions; existing unrelated findings remain (RLS tables with no policy, mutable search_path on another function, public pg_net extension, pre-existing SECURITY DEFINER grants, leaked-password protection disabled; performance unused-index notices).

### Application UI change
- `src/components/app/PredictionsView.tsx` now renders explicit odds status labels for CONFIRMED, STALE, SUSPENDED and MISSING, and checks the six-hour freshness window.
- Commit: `0eea9603164779217c06f5bfd860e36ed10af948`.

### Important remaining blockers
- No new bookmaker feed can produce live prices until a valid provider credential is configured. Current MoviOdds health remains `key_configured:false`; The Odds API cannot be validated against Belgian licensed books without its own key.
- The Play Store apps do not publish their private provider APIs; only their public comparison patterns have been adopted.
- The Odds API adapter is not deployed. Do not claim multi-bookmaker live comparison is active.
- Coupon creation still needs an end-to-end audit to ensure every leg requires an explicitly CONFIRMED, fresh, pre-match price; the trigger hardening alone does not certify every coupon UI path.
- The migration and UI commits are separate. No new live odds were ingested during this change because the feed has no credential.


## Coupon odds eligibility hardening — 2026-11-16

- Added `hasFreshConfirmedOdds()` in `src/lib/domain.ts`: requires odds > 1, explicit source and captured timestamp, age 0–6h, pre-match phase, and no suspended/stale/missing status.
- `saveCouponBatch()` now independently blocks MAIN/MEGA/EXTRA coupons if any leg lacks a fresh confirmed price. This is enforced in the save service, not only by a disabled button.
- Coupon preview now uses the same freshness predicate; stale or unsourced numeric odds are treated as missing for real coupon readiness. TEST coupons remain available for model-only simulation.
- Added unit tests for fresh, stale, suspended, in-play, missing-source/time, future timestamp and manual-source quotes.
- Commits: `66820efc26653cec9b1d0b94ae7140f3ff23056a` (domain helper), `46ce18e045c41f088d8756f7ee6bc7706d192ca0` (save guard), `808d2ed690bff0847737772004cde44bad907f9b` (coupon UI), `507d34db3868ccaf113cda064bc1a899a8648875` (tests).
- Migration file added to repository: `supabase/migrations/20261116134409_harden_provider_odds_prediction_sync.sql`, commit `c845958e6acdd4b76fdc32fb6df1516306402919`. The same migration is recorded in Supabase migration history as version `20261116134409`.

### Validation state
- Database trigger behavior was exercised with a temporary quote and the original prediction values restored; no test quote remains.
- Unit tests and TypeScript/build have not yet been observed passing in GitHub Actions in this session.
- Vercel status checks on the recent UI commits report `failure` with `build-rate-limit`; this is a Vercel account/build quota issue, not a verified source compilation error. Do not claim the Vercel deployment has completed.
- Latest source data query still finds zero fresh mapped prematch odds; a valid provider credential and successful feed sync are still required before real coupon prices can appear.


## Production health re-check — 2026-11-16 14:55 Europe/Brussels

### Confirmed healthy
- Supabase project `gzgeklcukrclgwbsmbsp` reports `ACTIVE_HEALTHY` (Postgres 17.11).
- Core tables exist: matches, predictions, provider_odds, odds_snapshots, coupons, coupon_legs, bankroll_transactions, scan_runs, match_results.
- Live Cloudflare Worker root `https://moneyball-global.damianwalus3.workers.dev` returns MONEYBALL GLOBAL 2.0 public shell; observed response time ~453 ms.
- Public Vercel URL `https://finalne-typy.vercel.app` returns a different page titled "Moneyball Intelligence", app-version 3.9.4, with tracker-specific copy; observed shell response ~145 ms. Treat this as a separate/legacy frontend until its deployment relationship is confirmed.
- Supabase MoviOdds GET health responds successfully in ~300 ms and correctly reports `key_configured:false`.
- Current Brussels-day fixtures in canonical matches table: 31 (25 scheduled, 3 live, 3 postponed).
- Current Brussels-day predictions: 252; 110 have a non-null numeric odds field; latest prediction row created 2026-11-16 13:17:53 UTC (14:17:53 Brussels). 24 rows were created in the preceding hour at the time of audit.
- FootyNomad sync requests return HTTP 200 and report 26 fixtures on latest refresh; results sync requests return HTTP 200 every five minutes.
- Today's scan_runs include 12 completed and 1 partial.

### Confirmed blockers / caveats
- No fresh mapped, unsuspended, prematch provider_odds quote exists within six hours.
- MoviOdds API key remains unconfigured, so there are no current bet365 quotes.
- Prediction cron job 11 (one-minute batches) is inactive. This was deliberately paused by migration `20261115195133_pause_overlapping_prediction_cron` to avoid overlapping heavy prediction runs. Do not reactivate it without replacing it with a bounded, non-overlapping batch scheduler.
- Result sync returns HTTP 200, but latest runs report 0 results saved / 0 predictions settled; alternate source reports 12 candidate matches, but no settlement was written in the latest checked run. This requires score/status matching audit before declaring automatic settlement healthy.
- The `moneyball-predict` endpoint returns 401 to an unauthenticated public GET; this is expected because `verify_jwt=true`, not proof of a broken function.
- Vercel checks on recent source commits fail with `build-rate-limit`; deployment of those changes is not confirmed.
- No logged-in end-to-end test of the protected app screens was possible in this audit. Public landing shell success is not proof that dashboard, coupons, statistics, or settlement screens work.

### Decision
- The product is not abandoned: database, Worker shell, FootyNomad refresh and result-sync scheduling are responding.
- It is not production-ready as a betting workflow: current odds feed is empty, prediction scheduling is paused, and settlement writes were not observed in the latest result-sync run.
- Next engineering work: (1) restore a bounded non-overlapping prediction batch scheduler, (2) audit result matching and verify at least one real finished match through prediction/coupon settlement, (3) activate a properly authorized odds feed, (4) unblock CI/build and confirm deployment, (5) authenticated E2E performance test.


## Professional production audit — 2026-11-16 (follow-up)

### Fresh database checks
- Current Brussels-day canonical fixture count: 34.
- Current Brussels-day prediction rows: 296; 186 have no numeric odds.
- Fresh mapped, unsuspended prematch provider quotes (captured within six hours): 0.
- All 864 rows in `match_results` have verified=true and both scores populated.
- All 864 matches with status=finished have a corresponding match_results row.
- There are 9 coupons total: 5 settled and 2 pending (the remaining 2 have other statuses).
- There are 6 pending coupon legs.
- 9,860 predictions across the database currently have settlement_status=pending. This is not, by itself, proof of a settlement bug: a separate check found zero pending predictions attached to matches currently marked finished, and zero pending predictions joined to verified result rows. Most pending predictions may belong to future/scheduled fixtures. Must break this down by match status and date before bulk reconciliation; do not bulk-settle blindly.
- Match statuses in the whole database: scheduled 1,439; finished 864; live 156; unknown 118; postponed 19.
- Result-source observations: FootyNomad 664 (latest 2026-11-15 22:51 UTC); ESPN 155 (latest 2026-11-16 14:10 UTC); TheSportsDB 17 (latest 14:10 UTC); OpenMatchday 13 (latest 2026-11-14 16:50 UTC). Secondary sources are therefore reaching the result-observation table.

### Scheduler diagnosis
- Active cron job 1 runs `moneyball-free-feed` at minutes 1,16,31,46 (every 15 minutes).
- Active cron job 2 runs `moneyball-results-sync?days=1` every 5 minutes.
- Odds cron job 10 is inactive.
- Prediction cron job 11 is inactive. Its old schedule was every minute and its request used a growing offset derived from elapsed minutes since 08:00, with batch_size=10. This is not a safe resumable queue: offset-based pagination can skip/repeat rows when the eligible fixture set changes, and the one-minute schedule was previously paused to prevent overlapping heavy requests. Do not simply reactivate it.
- Database has one active auth user, so current data is primarily scoped to one owner.

### Code-level findings
- `moneyball-results-sync` reads current-day FootyNomad fixtures and a set of alternate results providers. It first maps FootyNomad IDs, then uses exact normalized team order and a guarded date/time fallback. It deliberately refuses to settle ambiguous men's/women's duplicates and flags conflicting scores rather than guessing.
- The settlement routine writes a verified match result, marks the match finished, settles supported prediction markets, updates linked coupon legs and coupon status, and reconciles the coupon financial ledger. Unsupported market selections are skipped rather than force-settled.
- The production function currently has no demonstrated full end-to-end proof in this audit that a real newly-finished fixture progresses through source match -> verified result -> prediction -> coupon leg -> coupon financial ledger. Existing database totals show verified historical result rows, but that is not the same as a fresh live settlement test.
- `moneyball-predict` is active (version 210) and JWT-protected. It creates 1X2 and Double Chance records, plus independent Poisson goal-market rows. It stores selected prediction stake as €4.00. Its output explicitly marks missing odds/data as rejected and does not auto-create coupons. This function is expensive: it performs multiple external form/history lookups and batches DB writes. It needs a bounded, idempotent scheduler with a lock/lease and stable cursor before regular automation resumes.
- The function's generated 1X2/DC and GOALS rows are not evidence of calibrated probabilities or profitable performance. A historical backtest and calibration report are still required before any claim about hit rate/ROI.

### Current go/no-go
- Infrastructure: partial pass (database healthy; feed/result jobs scheduled; result observations and verified historical results exist).
- Prediction automation: fail/not active (cron paused; no safe replacement deployed).
- Bookmaker odds: fail/not active (zero fresh mapped prematch quotes; MoviOdds credential absent; odds cron disabled).
- Settlement: partial pass (historical verified results exist and no currently-finished match has pending predictions in the quick integrity checks; a fresh end-to-end settlement proof is still missing).
- Coupon accounting: partial pass (coupon records and settled states exist; 6 legs remain pending; full ledger audit and fresh controlled coupon settlement proof still required).
- Performance/build/deployment: not certified in this pass. Previous Vercel build-rate-limit remains a deployment blocker; protected authenticated screens were not tested.
- Decision: continue the project, but keep it in simulation/test mode. Do not enable real-money coupon eligibility or reactivate the old prediction cron. The next implementation must add an idempotent leased prediction queue, and the next test must exercise one real finished fixture through the entire result/settlement/ledger chain without fabricating scores. Odds remain a separate external credential/coverage dependency.


## Manual prediction scan fallback — 2026-11-16

- Added a manual full-day scan action to the authenticated dashboard in `src/routes/_authenticated/panel.tsx`.
- Button label: `Skanuj dzisiejsze mecze`. It calls the existing JWT-protected `moneyball-predict` Edge Function through the logged-in Supabase client.
- It processes today's Europe/Brussels date in sequential batches of 10 using the function's existing offset/batch_size contract. It does not launch parallel prediction calls. A hard ceiling of 100 batches prevents an unbounded browser session.
- It reports the number of matches analyzed, predictions created/updated, selected model picks and batch count, and surfaces function errors. It refreshes dashboard summary, selected picks and finance queries after a completed scan.
- The automatic fixture feed remains separately scheduled every 15 minutes; this button analyzes fixtures already synchronized into the canonical database. If a just-announced fixture has not yet been imported, wait for feed refresh or use the normal feed schedule.
- It does not create coupons or place bets. The existing coupon flow still enforces fresh confirmed odds. This is a manual operational fallback, not a replacement for a durable server-side leased queue.
- No cron schedule was re-enabled. No API keys or paid services were added.
- GitHub commits: `e1d15c59aba1496239a8b13f4d5e8df25cbca3ee` (button and sequential batch runner), `eab093eaa538c2a80ae0657f53ca4ecc71357a28` (Brussels date helper fix).
- Deployment/build and authenticated browser click test are not yet confirmed. The button is committed to `main`, but must not be described as visible in production until the deployment succeeds.


## Coupon eligibility guard and production URL audit — 2026-11-16

- Commit `617921a2e8d4ec6d2cfffc065d1cace363b41dcf` adds a persistence-boundary guard in `src/lib/coupons.ts`: new coupons cannot save a prediction unless verdict is `WYBRANY`, settlement is `pending`, and probability is strictly greater than 75. Cloudflare deployment workflow run `#384` and CI run `#781` both succeeded.
- Follow-up commits `ed0ed7698b01950d9c7f1659ecaf7accc4768fc2`, `5f3081eeadab69742591b913a15202d4663d1137`, and `61fa50ebfd067728296d74e2b0def3d679178c2c` extract the eligibility rule into `isEligibleCouponPrediction` and add tests for accepted, rejected, settled, threshold-equal and null-probability rows.
- CI run `#784` for commit `61fa50e` completed successfully: Deno Edge Function type check, tests, TypeScript type check and production build all passed.
- Cloudflare deploy workflows `#386` (commit `5f3081e`) and `#387` (commit `61fa50e`) were still in progress/pending at the time of this entry. Do not claim the latest guard/test commits are deployed until the exact latest SHA is confirmed successful.
- Correct production URL is `https://moneyball-global.damianwalus3.workers.dev/`. Public shell check confirms it describes the correct €4 analytical stake and the 1X2, Double Chance and Goals markets. The similar `moneyball-global-test.damianwalus3.workers.dev` URL is a test/staging host and still displays old €5 copy; do not mistake that for the production Worker. `/panel` is authentication-protected; public audit cannot inspect signed-in screens.
- Public Vercel URL `https://finalne-typy.vercel.app` is a separate/legacy Moneyball Intelligence tracker (app-version 3.9.4), not the documented production Moneyball Global Worker. Do not use it as proof of current production deployment.
- Supabase production data check: two recent test coupons have €4 stake each and exactly one stake transaction apiece; both remain pending and have no return transaction yet. One legacy test coupon contains an ODRZUCONY leg; it is preserved for audit and not modified. This is why the new guard must be tested on future saves, not by rewriting history.
- Latest observed results-sync function version 68 completed two recent cycles with 79 FootyNomad fixtures, 13 matches matched, 2 results saved, 26 predictions settled, 0 errors; ESPN dynamic selection used 2 leagues and 11 events. The second cycle had a longer reschedule reconciliation stage (about 2.6s), so keep collecting samples before claiming a stable overall runtime improvement.
- Current frontend route configuration already uses TanStack Router `defaultPreload: "intent"`, zero preload delay, and a 120-second preload freshness window. This is implemented, not a new fix to repeat. Coupon and match page data queries are still multi-stage; authenticated browser timing is unavailable because the panel requires login. Public shell timings are not representative of authenticated navigation.
- External technical references consulted: TanStack Router data loading and preloading docs (https://tanstack.com/router/latest/docs/guide/data-loading, https://tanstack.com/router/latest/docs/guide/preloading); TanStack Query request waterfalls (https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls); Supabase query/index optimization (https://supabase.com/docs/guides/database/query-optimization, https://supabase.com/docs/guides/database/postgres/indexes); Cloudflare static assets and cache docs (https://developers.cloudflare.com/workers/static-assets/, https://developers.cloudflare.com/workers/cache/). These support the next performance investigation: identify and remove sequential data waterfalls and verify real query plans before adding indexes; static assets are automatically edge-served, while authenticated API/database requests need separate analysis.

### Next steps — do not repeat completed items
1. Confirm Cloudflare deploy run `#387` for exact commit `61fa50e`; then check production root metadata/copy and retain `/panel` auth boundary.
2. In a future real authenticated session, test creating a new coupon with an ODRZUCONY prediction and confirm it is blocked; test a valid WYBRANY >75% batch and confirm save succeeds. Never mutate old rows for this test.
3. Continue the existing scoped-query refactor documented above; prioritize route-specific query waterfalls and remaining full-history prediction consumers. Preserve all historical data and finance totals.
4. Observe the next real final results for the two €4 test coupons. Verify coupon legs, coupon terminal status, gross return, net profit/loss, and exactly-once ledger settlement after multiple cron cycles. Do not fabricate results.
5. Obtain authenticated navigation measurements before claiming menu-speed issue resolved. Public homepage latency alone is not enough.


## Bounded parallel reads for match and coupon pages — 2026-11-16

- Inspected the live source in `src/lib/db.ts`. The match and coupon page loaders had sequential chunk loops for predictions, match results, related coupon legs, odds snapshots, historical match rows and linked coupons. These were request waterfalls: later independent 100-ID batches waited for the previous batch even though they can be fetched independently.
- Added `fetchInChunks()`: preserves chunk order, runs at most four independent 100-ID chunks concurrently, and retains the existing owner-scoped filters, selected columns, per-request timeout and error handling. Applied it to the independent chunk reads in `fetchCouponPageData()` and `fetchMatchPageData()`. The initial four independent page reads were already parallel and remain unchanged. No database rows, coupon rules, refresh cadence, or historical data were changed.
- Commit: `d5c1539e2c8193f85b1fc8c3fcd2063b20c9e34c` — `perf(data): parallelize bounded match and coupon page reads`. Source was fetched back from GitHub at this exact SHA and confirmed to contain the helper and replacements.
- CI run `#786` for this commit was observed in progress at the time of this note. Cloudflare deploy run `#389` was pending behind the production deployment concurrency group. Do not claim this frontend change is live until CI and the exact-SHA Cloudflare deployment succeed.
- Previous deploy run `#388` for docs-only SHA `58c2274` was cancelled because a higher-priority queued production deployment existed; run `#387` was also cancelled. Run `#386` for SHA `5f3081e` had previously been in progress. Check the Actions page for the final state of `#386` and `#389` before drawing deployment conclusions.
- Latest available Supabase function logs for `moneyball-results-sync` show HTTP 200 cycles with measured execution times: 17:45 UTC 9.785s; 17:40 7.475s; 17:35 4.757s; 17:30 16.089s; 17:25 11.194s; 17:20 13.062s; 17:15 15.169s; 17:10 10.033s; 17:05 11.778s; 17:00 9.651s; 16:55 9.842s; 16:50 10.866s. This confirms repeated successful HTTP responses and variable latency, not a guaranteed speedup or zero internal errors; inspect structured function logs/request summaries for settlement counts when available.
- The CI page reports Node.js 20 deprecation and upcoming Ubuntu runner migration warnings; they did not fail CI run #785. These are maintenance warnings, not the present user-facing timeout cause.

### Next checks
1. Confirm CI `#786` and Cloudflare production deployment `#389` for exact SHA `d5c1539`; then verify the production Worker shell and, where possible, authenticated page navigation.
2. Compare before/after authenticated match and coupon page load timings across repeated visits. Do not claim the UI is faster solely because code now issues parallel requests.
3. Continue removing full-table history reads from legacy screens, preserving all-history financial totals through existing summary RPCs and using scoped/cursor reads where appropriate.
4. Continue monitoring results-sync cycle metrics and verify real match -> prediction -> coupon leg -> exactly-once €4 ledger settlement without synthetic scores.


## Prediction-page loader waterfall and production verification — 2026-11-16

- Follow-up audit found a concrete missing preload: `PredictionsView` calls `useTable("matches")`, `useTable("predictions")` and `useTable("coupon_legs")`, while the three route loaders (1X2, Double Chance, Goals) preloaded only matches and predictions. Because these are Suspense queries, the missing coupon-leg query could suspend after the first two reads. The route loaders now preload all three tables together through the existing `ensureTables()` Promise.all.
- Changed files: `src/routes/_authenticated/prognozy-1x2.tsx`, `src/routes/_authenticated/double-chance.tsx`, `src/routes/_authenticated/prognozy-gole.tsx`. The latest combined code commit is `40fc4dba402c4c787276c6201cdc456d3f2fe76b`.
- CI `#790` for SHA `40fc4db` succeeded (43 seconds). Cloudflare production deploy `#393` for the same SHA succeeded (1m 6s). Workflow run IDs: CI `43922433729`; deploy `43922433719`. All build/type-check/test/deploy steps shown in the jobs completed successfully.
- The production Worker root was rechecked and returns the Moneyball Global 2.0 public shell with the fixed €4 analytical stake. The root is not an authenticated panel performance test.
- The database contains 2,596 matches, 18,563 predictions, 877 match_results, 9 coupons, 22 coupon legs, 8 odds snapshots and 7 bankroll transactions at the time of inspection. No rows were modified by this audit.
- Reviewed indexes on the principal tables. The predictions unique index `(owner_id, match_id, model_version, market, selection)` already has the `(owner_id, match_id)` prefix used by today's prediction reads. The matches table already has owner/kickoff indexes; coupon legs and odds snapshots have owner/prediction indexes. No speculative duplicate indexes were added. This follows Supabase's guidance to inspect query plans and avoid over-indexing.
- Official technical references used:
  - TanStack Query request waterfalls: https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls
  - TanStack Query parallel queries: https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries
  - Cloudflare Workers metrics and request duration: https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
  - Cloudflare Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
  - Supabase query optimization/index advisor and over-indexing guidance: https://supabase.com/docs/guides/database/query-optimization
- Latest results-sync measurement observed at 17:50:13 UTC was 13.510 seconds and HTTP 200. The recent 15-cycle sample ranges roughly 4.8–16.1 seconds, so the scheduled results sync remains operational but latency is variable; do not mark timeout prevention fully proven.
- The two active €4 test coupons remain pending. MONEYBALL #1 has two live legs (Lithuania–Liechtenstein and Iceland–Luxembourg) and one scheduled leg (Gibraltar–Malta). MONEYBALL #2 has one scheduled leg (Greece–Serbia), one legacy ODRZUCONY leg (Switzerland–Scotland) retained unchanged for audit, and one won leg (Faroe Islands–Moldova 1:0). Each coupon still has exactly one €4 stake transaction and zero return transactions. Do not settle either coupon until all legs have verified final outcomes; do not rewrite the legacy rejected leg.
- No authenticated panel navigation timing has been captured. It remains necessary to measure menu changes and first-load timings from a real signed-in session or Cloudflare/Browser telemetry; public root latency is not a substitute.

### Next verification / optimization queue
1. Collect repeated authenticated timings for Panel, 1X2, Double Chance, Goals, Matches, Coupons, History, Statistics and Bankroll, separating cold load from cached navigation.
2. Consider paginated/history-specific reads for the 18,563-row predictions table only after preserving all-history filters and Brier/Log Loss calculations; do not simply truncate records.
3. Monitor results-sync internal structured logs and real match settlements, including exactly-once bankroll returns.
4. Keep route preloading and bounded parallel reads; do not add duplicate indexes without EXPLAIN/Index Advisor evidence.


## Follow-up verification and next performance target — 2026-11-16

### Completed workflow verification
- Checked the final jobs for docs commit `aea730adb3fe9a3fb146de924a0a985200ce10c8`.
- CI workflow run `#791` / run ID `43922718349`: SUCCESS. Deno Edge Function type-check, tests, TypeScript type-check and build all completed successfully.
- Cloudflare production deploy workflow run `#394` / run ID `43922718316`: SUCCESS. Build for Cloudflare Workers and Deploy to Cloudflare Workers completed successfully.
- The functional code SHA `40fc4dba402c4c787276c6201cdc456d3f2fe76b` had already been deployed successfully by production deploy `#393`; run `#394` subsequently completed for the documentation commit. Production remains `https://moneyball-global.damianwalus3.workers.dev/`.
- This verifies CI and the production deployment workflow. It does NOT verify signed-in menu speed; no authenticated browser timings are available in this session.

### Newly confirmed full-history read on prediction screens
- Re-read current `main` source: `src/components/app/PredictionsView.tsx` calls `useTable("predictions")`, `useTable("matches")` and `useTable("coupon_legs")`.
- The `current` model scope only filters the already-downloaded predictions array in the browser using `isActivePredictionVersion()`. Selecting `Wszystkie wersje` also operates on the same complete in-memory array. Therefore the default view still downloads the full prediction history even when only the active model is shown.
- `src/lib/db.ts` currently uses keyset pagination in 250-row pages across four UUID partitions (at most two partitions concurrently) to fetch the full predictions table. This protects against deep OFFSET scans and reduces per-query timeout risk, but it still transfers all historical prediction rows to the browser.
- Previously inspected data volume was 18,563 predictions and 2,596 matches. The full-history transfer is therefore a concrete remaining performance cost, not a hypothetical rendering issue.
- The screen also calculates its selected-pick hit rate from the full in-memory history. Any optimization must preserve this all-history statistic (or replace it with an equivalent verified server-side aggregate), preserve active-vs-all model version semantics, and retain access to every historical prediction.
- Do not merely truncate the array, change the 120-second cache, or hide history. Next safe design is server-side scoped reads for the initial/current view plus cursor-paginated archive access; compute all-history market statistics independently with verified aggregate semantics. Keep edits/deletes and coupon-leg protections intact.

### Current results-sync latency sample
- Queried recent production Edge Function request logs for `moneyball-results-sync`.
- Version 68 at 2026-11-16 17:55:20 UTC returned HTTP 200 but took 20,238 ms. Previous samples: 17:50:13 13,510 ms; 17:45:09 9,785 ms; 17:40:07 7,475 ms; 17:35:04 4,757 ms. Earlier versions 65–67 also returned HTTP 200 with runtimes from about 10 to 16 seconds.
- This confirms the function continues to answer successfully but latency remains highly variable and has not been proven stable or timeout-proof. Continue inspecting structured summaries and stage timings; do not claim a permanent timeout fix.

### External research used for this decision
- TanStack Router data loading recommends coordinating route data early and loading independent requirements in parallel: https://tanstack.com/router/latest/docs/guide/data-loading
- TanStack Router supports intent preloading and reuse of cached/preloaded route data: https://tanstack.com/router/latest/docs/guide/preloading
- TanStack Query identifies dependent request waterfalls as a major performance footgun: https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls
- TanStack Table documents server-side pagination and cursor-based pagination patterns: https://tanstack.com/table/latest/docs/framework/react/guide/pagination
- Community discussions on large React datasets consistently distinguish virtualization (render cost) from server-side pagination/filtering (network and memory cost); use as anecdotal guidance, not authoritative proof: https://www.reddit.com/r/reactjs/comments/1o2h9j7/frontend_devs_working_with_large_datasets_100k/ and https://www.reddit.com/r/reactjs/comments/1pk0ipl/how_to_optimize_tanstack_table_react_table_for/

### Next implementation sequence
1. Inspect active model-version definitions, prediction timestamp/market indexes, and existing summary RPCs before changing query shape.
2. Add an owner-scoped query for the current prediction screen's required slice; use deterministic keyset pagination for archive/history and avoid large IN lists or offset scans.
3. Preserve complete all-history hit-rate/statistics through a verified SQL aggregate or a paginated archive calculation; cross-check aggregate output against the existing full-history client calculation before switching.
4. Add tests for active/all model scopes, market filters, verdict filters, cursor boundaries, duplicate prevention and historical aggregate equivalence.
5. Run CI/build, deploy to the existing Cloudflare Worker, then compare cold and cached navigation in an authenticated session. Do not mark the menu-speed issue fixed without measured signed-in timings.
6. Keep monitoring the 5-minute results-sync schedule and inspect stage summaries, result settlement counts and exactly-once coupon ledger writes. Never fabricate outcomes or mutate historical coupons.


## Prediction screen server pagination — 2026-11-16

### Root cause
- `PredictionsView` loaded `useTable("predictions")`, downloading the complete 18,563-row table even though each view displays one market at a time.
- The full-history fetch used four UUID partitions and repeated keyset reads. PostgreSQL logs showed 11 prediction-table statement timeouts on Nov 15–16.
- The existing `predictions_verdict_idx` was selected for a representative owner+market+active-model query. It filtered owner/model after scanning rows and sorting.

### Database changes applied and verified
- Added `moneyball_predictions_page` as a SECURITY INVOKER RPC, explicitly scoped to `auth.uid()`, with validated market/model/verdict inputs, max page size 100, cursor pagination, and server-side totals/hit-rate stats.
- Added `moneyball_predictions_owner_market_created_idx` on `(owner_id, market, created_at DESC, id DESC)`, including model/verdict/settlement fields.
- First query-plan comparison for the representative page read:
  - Before composite index: 1,716.830 ms, 2,103 shared blocks.
  - After composite index: 3.666 ms, 44 shared hits + 3 reads, index-only scan.
- Initial full RPC plan materialized the shared CTE and spilled to temp blocks (270.183 ms). Replaced it with NOT MATERIALIZED CTEs and a bounded page CTE; latest full RPC EXPLAIN ANALYZE: 38.086 ms, 3,938 shared hits, zero temp reads/writes.
- Authenticated functional test:
  - Current 1X2 total 2,458; first and second pages each 50 rows; zero duplicate IDs.
  - pending 1,122; selected verified won/settled 2/2.
  - Current Double Chance 5,142; current Goals 8,312; all-version 1X2 3,324.
- No prediction, match, coupon, bankroll, or result rows were modified by these tests.

### Frontend changes in PR #63
- New `fetchPredictionsPage` client calls the RPC with 50-row pages.
- `PredictionsView` uses `useInfiniteQuery`; market/model/verdict/search filters are server-side; “Wczytaj kolejne 50” loads archive incrementally.
- Hit rate and counts come from the full database scope, not the loaded page.
- The three prediction routes no longer preload the full predictions table; they still preload matches and coupon legs needed by the UI.
- Successful and failed mutations invalidate the new `prediction-pages` cache.
- New migrations in repo:
  - `20261116183000_moneyball_predictions_server_pagination.sql`
  - `20261116183500_moneyball_predictions_page_composite_index.sql`
  - `20261116184000_optimize_moneyball_predictions_page_ctes.sql`
- PR: https://github.com/damianwalus3-jpg/moneyball-global/pull/63
- CI is not triggered on pull_request by the current workflow configuration; production deploy runs only on push to main. Do not merge/deploy until code validation is complete. After merge, verify CI and Cloudflare deployment before calling the frontend fix live.

### Remaining checks before release
1. Validate TypeScript and production build for PR #63.
2. Add/execute regression checks for page cursor ordering, verdict/search filters, current/all model scope, and full-scope hit-rate parity.
3. Merge only after checks pass; confirm production deploy success.
4. Measure authenticated navigation timings after deployment; public Worker root timings are not a substitute.
5. Recheck all other full-history consumers (History, Results, Statistics, Matches, Coupons and scan deduplication) separately; this PR only fixes prediction screens.


## Release confirmation — prediction screen pagination — 2026-11-16

- PR #63 merged to `main` as commit `37eac0b628499b5e4cb5ea6c30d0bdda541d8dd0`.
- GitHub Actions CI #798 / run ID `43926120481`: SUCCESS. Deno Edge Function type-check, tests, TypeScript and build all succeeded.
- Cloudflare production deploy #396 / run ID `43926120530`: SUCCESS.
- Cloudflare Worker production URL: `https://moneyball-global.damianwalus3.workers.dev/`.
- Exact deployed Cloudflare Version ID: `4754b474-5f42-426f-bfd5-cf866f8b28f8`.
- Deploy log confirms upload of the new `PredictionsView` asset and the updated 1X2/Goals route assets.
- The earlier note in the PR-stage section saying CI had not run and merge was blocked is superseded by this release confirmation.
- This confirms the production deployment pipeline and exact Worker version. It does NOT establish authenticated panel navigation timings; the signed-in browser session was unavailable, and a public-root fetch could not be independently completed in this environment.

### Post-release results-sync sample
- Version 68, 2026-11-16 18:00:07 UTC: HTTP 200, 7,805 ms.
- Version 68, 18:05:06 UTC: HTTP 200, 6,645 ms.
- Version 68, 18:10:07 UTC: HTTP 200, 7,561 ms.
- Each structured request summary: dates [`2026-11-16`], fixturesFetched 79, matchesMatched 13, resultsSaved 2, predictionsSettled 26, couponLegsSettled 0, alternateResultsFetched 14, alternateResultsMatched 13, errors 0.
- Three consecutive cycles show improved and consistent latency versus the earlier 20.238 s outlier, but keep monitoring; do not claim zero future timeouts. Coupon-leg settlement remains unverified by these cycles.

### Next regression targets
- Do not repeat full-history fetching on other screens. Remaining identified consumers include History, Results, Statistics and SettleMatchDialog; scan import deduplication also needs a separate safe strategy.
- Convert each screen to owner-scoped queries/pagination or a verified aggregate while preserving full historical records, search, model-version scope, result corrections and coupon relationships.
- The prediction screen page uses created_at/id cursor order; if later changing sort order to kickoff date, redesign the cursor and add duplicate/missing-row regression tests before shipping.
- After each release, compare full-scope totals and hit rates against SQL, test first/next pages for duplicate IDs, and verify all three market filters.
- Keep the authenticated menu-speed issue open until actual signed-in P50/P95 navigation measurements are available.


## Next performance wave — Results and match settlement — 2026-11-16

### Results screen root cause and implementation
- The Results screen previously loaded all `matches`, `predictions` and `match_results`, then filtered to a rolling 96-hour window in the browser.
- A DB count showed 1,035 fixtures and 6,624 predictions in that window, so merely applying a date filter after downloading all history was not enough.
- Added owner-scoped `moneyball_results_page` SECURITY INVOKER RPC:
  - filters rolling 72-hours-back / 24-hours-forward window in SQL;
  - applies FINAL / rejected / JACKPOT and search filters on the server;
  - returns 30 matches per page with only required match/result/pick fields;
  - calculates total match/pick/selected/verified/missing-result counters over the complete filtered scope;
  - stable cursor `(kickoff_at,id)`, capped at 50 rows;
  - active model + MANUAL scope preserved.
- SQL plan work found that serial correlated count subqueries caused high cost. Replaced them with a single active-predictions-per-match aggregate. Then reduced payload to only fields used by the Results UI.
- Final function EXPLAIN ANALYZE: 71.369 ms; no temp spill. Earlier full-row JSON payload measured 3.36 s, which was rejected and replaced before frontend release.
- Authenticated DB regression tests:
  - first/second pages: 30 + 30 rows, zero duplicate match IDs;
  - 972 filtered matches, 6,616 active predictions, 26 selected picks, 262 verified results at latest sample;
  - FINAL=13 matches, rejected=972, JACKPOT=0, search Chernihiv=1;
  - requested page size 100 is capped to 50.
- Migrations applied:
  - `20261116190000_moneyball_results_server_pagination.sql`
  - `20261116190500_optimize_moneyball_results_page_aggregation.sql`
  - `20261116191500_reduce_results_page_payload.sql`

### Match settlement dialog
- Removed its dependency on full `useTable("predictions")`.
- Added owner-scoped `fetchPredictionsForMatch(matchId)`; only predictions belonging to the selected match are fetched.
- Save is blocked with a clear error if that match's prediction query fails, avoiding an unsafe partial settlement.
- Existing full coupon-leg, coupon and result inputs remain unchanged; no settlement rules, transactions, or history are altered.

### Frontend release status
- Branch: `perf/scoped-results-and-settlement`.
- Results UI now uses `useInfiniteQuery`, with 30-match “load more” pages and server-side filters.
- `useAction` resets result pages after result sync/settlement to refresh only the first page, instead of refetching every loaded page.
- This wave still requires GitHub CI, TypeScript, production build and Cloudflare deployment before release.
- History and Statistics still need their own safe full-history refactors; do not mark all menu screens optimized.


## History / settlement queue pagination — 2026-11-16

### Root cause and replacement
- `Historia` previously loaded all matches, all 18,563 predictions, all match results and all coupon legs into the browser, then repeatedly filtered predictions per match.
- Added SECURITY INVOKER RPC `moneyball_history_page`, scoped by `auth.uid()`, with 30-match cursor pages (maximum 50).
- Preserves the previous queue rules:
  - TODO: kickoff is in the past, match is not cancelled/postponed, no verified result, and there is either a selected pending prediction or a pending coupon leg tied to a selected prediction.
  - DONE: verified match result or cancelled/postponed fixture.
  - TODO order is oldest kickoff first; DONE order is newest first; null kickoff fixtures remain at the end of DONE.
  - Search and tab counters retain prior semantics.
- Each page returns only the match, its latest result, and predictions belonging to that match. No global predictions array is loaded.
- Match settlement dialog continues to load predictions only for the chosen match (PR #64); existing coupon legs, coupons and result rows are retained for the settlement routine.

### Database regression checks
- Current direct counts: TODO=3, DONE=897.
- RPC returned TODO first page=3 and DONE first/second pages=30+30, with zero duplicate match IDs.
- Search `Chernihiv` in DONE returned 2 matches; requested page size 100 is capped to 50.
- Coupon-leg integrity check: 0 mismatches between `coupon_legs.match_id` and the linked prediction's `match_id`; no pending coupon legs with null match_id.
- Authenticated EXPLAIN ANALYZE for first DONE page: 33.572 ms, 2,419 shared hits, zero temp spill.
- No data rows, historical results, coupons or bankroll transactions changed.

### Migration and frontend
- Applied migration: `20261116193000_moneyball_history_server_pagination.sql`.
- Branch: `perf/history-pagination`.
- `Historia` now uses `useInfiniteQuery` and a “Wczytaj kolejne 30” action; its route prefetches only the first TODO page and the small tables still needed by SettleMatchDialog.
- Mutations reset the history page cache so corrected results re-enter the proper queue.
- Paginated query polling stops when more than one page is loaded, avoiding sequentially refetching every page; focus/reconnect refetch is disabled for this large list. This follows TanStack Query guidance that infinite-query refetches fetch stored pages sequentially and that limiting refetches reduces network work: https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries
- Still requires CI, TypeScript/build, merge and Cloudflare deploy validation.
- Statistics remains the last major full-history consumer and needs a separate aggregate/detail design; do not mark all screens optimized yet.


## Settlement-context follow-up on current main — 2026-11-16

- Main now contains the previously separate History pagination work and the Results pagination implementation. This follow-up branch is based on the current main SHA `95d0359d55bdc5794c0fb9ee31aed1b920f620a4`; it does not replace or revert the History work.
- Results page first-page preloading added to the route loader and server search debounced by 250 ms. Existing results page cache remains at 10 minutes.
- SettleMatchDialog still had three whole-table reads (`coupon_legs`, `coupons`, `match_results`) even after the History change had scoped predictions to one match.
- Added `fetchMatchSettlementContext`: query predictions and latest result for one match; discover affected coupons through those prediction IDs; then load **all legs** for those coupons and only the affected coupon rows. This is essential because coupon status and combined odds must use all three legs, not only the current fixture.
- `useAction` invalidates `match-settlement-context` after mutations.
- The live `moneyball_results_page` function now also includes the required `note` key in each prediction JSON object. Added migration `20261116195000_moneyball_results_page_include_prediction_note.sql` to keep the repository schema history aligned with the live DB.
- Authenticated read-only regression: 30+30 rows, 0 duplicate match IDs, 6,538 active predictions across 966 matches at sample time, 26 selected, 0 missing `note` keys. Counts vary with the rolling time window.
- Existing two test coupons still have exactly three legs each; this check did not alter either coupon or any transaction.
- This follow-up must pass a fresh CI run on its exact PR head. Do not merge if CI cannot be confirmed.
