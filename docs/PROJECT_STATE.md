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


## Statistics screen scoped prediction reads — 2026-11-16

- Root cause: Statistics used `useTable("predictions")`, downloading all 18,563 predictions before filtering to active model/manual entries and top-two European domestic leagues.
- Authenticated SQL baseline at implementation time: 2,596 matches, 18,563 predictions, 344 eligible top-two European matches, 1,141 active-model/manual predictions attached to those matches; 9 coupons and 22 coupon legs.
- Added `fetchStatisticsPageData`:
  - loads matches, coupons and coupon legs through the existing keyset-paginated `fetchAll` loader (important: direct PostgREST SELECT would silently cap at 1,000 rows);
  - applies the exact existing `isEuropeanTopTwoLeague` function in the domain layer, avoiding a second, subtly different SQL copy of the league rules;
  - requests predictions only for eligible match IDs and only active model 3.8 / MANUAL versions, in 100-match chunks with bounded parallel waves.
- Statistics calculations and UI remain unchanged: selected/rejected/settled counts, 1X2/DC/Goals separation, Brier, Log Loss, calibration, multiclass 1X2, league/bucket hit rates, coupon ROI and incomplete-payout safeguards are still computed by the existing domain functions.
- Route loader prefetches the scoped dataset; query cache is invalidated after mutations.
- No DB migration or data writes required. This reduces prediction payload from 18,563 to about 1,141 rows (about 93.9% fewer) while preserving full active-model history for the supported league scope.
- The implementation was already present on `main` at SHA `9d639ad8fa4e6f75ddc5f8b7ca06140c0cea253a` (same scoped query and route wiring), so a duplicate/stale PR #72 was closed without merging; no code was reverted.
- Production CI #811 passed: https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43931645379
- Production Cloudflare deploy #402 passed: https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43931645518
- Worker version ID: `d4af00f2-f226-464c-8f0a-49cf64a3f977`; production URL: https://moneyball-global.damianwalus3.workers.dev
- Duplicate PR closed: https://github.com/damianwalus3-jpg/moneyball-global/pull/72
- Authenticated screen latency still needs a real signed-in UI measurement; CI/deploy success does not establish menu speed.


## Cache consistency guard — 2026-11-16

- Follow-up audit found `deleteRow` did not invalidate the raw table cache, unlike `insertRows` and `updateRow`. After a delete, React Query could refetch a table through the still-warm raw cache and temporarily reintroduce the deleted row in statistics or related screens.
- Added raw table cache invalidation before delete, matching insert/update behavior.
- Added targeted statistics and match-settlement-context invalidation to `useAction` error handling, because a multi-step settlement may have partially written before a later operation fails. This ensures affected screens re-read current database state instead of showing stale derived data.
- No schema or data changes. CI required before merge.


## Post-deploy runtime audit — 2026-11-16 19:30 UTC

- Production Worker SHA `9d639ad8fa4e6f75ddc5f8b7ca06140c0cea253a` deployed successfully as Cloudflare Worker version `d4af00f2-f226-464c-8f0a-49cf64a3f977` (deploy workflow #402). CI #811 passed.
- The deployed asset manifest includes a dedicated `statystyki-*.js` bundle; the route uses `statisticsPageDataQuery` and no longer calls `useTable("predictions")`.
- The attempted duplicate PR #72 was closed without merge because its scoped-statistics implementation was already present on main. No code was reverted or duplicated.
- Supabase PostgreSQL log audit for 10:07–19:30 UTC found 23 PostgREST statement-timeout events involving the old unscoped `predictions` keyset scans, between 12:13:49 and 12:36:27 UTC. These all predate the current 18:43 UTC production deploy; no later PostgREST prediction timeout was observed in the queried window.
- Results-sync function version 68 continued returning HTTP 200 every 5 minutes. Recent execution times between 18:50 and 19:15 UTC ranged 4.859–9.496 seconds; earlier 17:55 UTC peak was 20.238 seconds. No 5xx response was observed in the queried logs. Latency remains variable, so timeout elimination is not claimed.
- Next: monitor logs after this deployment for recurrence of prediction timeouts and obtain a real authenticated Statistics / Results / History / menu timing measurement. Public root latency is not a substitute for authenticated measurements.


## CSV import duplicate lookup — deployed to MONEYBALL GLOBAL Main (2026-11-16)

- PR #73 was merged as `f8004c60032323b7bff72b9850944b5687b4aed2`. The implementation is now on `main`.
- `src/lib/scan-import-service.ts` no longer calls `fetchAll("predictions")` to detect CSV duplicates. It calls `fetchExistingPredictionKeysForMatches`.
- The helper is owner-scoped, queries only imported match IDs in batches of 100, selects the duplicate identity columns, and keyset-pages each batch by UUID in pages of 1,000 rows. This avoids both a full prediction-history scan and the PostgREST 1,000-row response cap.
- Duplicate identity remains `match_id + model_version + market + selection`; already-existing predictions are skipped, never overwritten or deleted. New rows remain inserted in existing batches of 500. No DB migration was needed.
- Exact PR-head CI run #816 passed all steps: Deno checks, tests, TypeScript and build.
- Main CI run #817 passed. Main Cloudflare deployment run #818 passed all steps, including build and deploy.
- Cloudflare Workers Builds check for the merged main commit also completed SUCCESS (build `c7d7946e-0e63-4bd5-a944-7d30536ad435`). The earlier immediate PR-build failures are not the current main status.
- Production Worker: `https://moneyball-global.damianwalus3.workers.dev`; deployed Worker version: `fd91d2df-6d76-45b5-b5c4-09161e11c863`.
- Public production root was rechecked after deployment and returned the MONEYBALL GLOBAL 2.0 page with the correct €4 analytical stake. The authenticated `/panel` route correctly requires login; authenticated menu timing has not been measured.
- Read-only database verification after deployment: matches 2,596; predictions 18,563; coupons 9; coupon legs 22; match results 883; bankroll transactions 7. No coupon, leg, bankroll or transaction rows were altered by this change.
- The active results-sync cron remains `*/5 * * * *`. The audited 19:20–19:40 UTC sync executions returned HTTP 200 in about 7.1–9.0 seconds. PostgreSQL timeout search for 19:18–19:45 UTC returned no timeout events.
- Do not repeat this scoped CSV deduplication work. Continue monitoring only for regressions or new bottlenecks; do not modify historical financial records without explicit user instruction.


## History route navigation latency follow-up — 2026-11-16

- Audit found the History route loader was awaiting three whole-table reads (match_results, coupons, coupon_legs) in addition to prefetching the first paginated history page.
- Those three reads were obsolete: the current SettleMatchDialog obtains a scoped settlement context only after a specific match is selected, via fetchMatchSettlementContext.
- Removed the redundant whole-table reads from the History route loader.
- Changed the first history page prefetch to background/non-blocking. The History component already owns explicit loading and error states, so the page shell can render immediately while the first page loads.
- No settlement logic, coupon data, match results, bankroll, or historical records are modified. The selected-match dialog continues to fetch and validate its own complete affected-coupon context before allowing settlement.
- Validation completed: PR #74 merged as `0658b2db5183d12578d2a80d38e16b103907fce1`; main CI run #820 passed (https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43944242435); Cloudflare Main deploy run #408 passed (https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43944242470).
- Deployed production Worker version: `4413a358-877a-40a7-bf72-622a93f16f6f` at https://moneyball-global.damianwalus3.workers.dev.
- The Vercel status check reported its separate build-rate-limit failure; it is not the production host and did not block the successful Cloudflare deployment.
- This is a targeted reduction of History navigation's blocking work. Actual authenticated navigation latency still requires a signed-in browser measurement; do not claim the entire menu issue is solved.


## Prediction tabs — scope match reads to visible rows (2026-11-16)

- Audit found all three prediction tabs preloaded the complete matches table (2,596 rows at the last authenticated baseline) before showing the screen, even though the visible list is paginated to 50 predictions.
- Replaced the initial full match-table dependency with an owner-scoped lookup for only the distinct match IDs referenced by the currently loaded prediction pages, in batches of 100.
- The full match list is now fetched only when the user opens the manual prediction form; the form shows a loading message while that deferred list is fetched.
- Coupon-leg checks remain fail-safe: edit/delete controls are unavailable until the coupon-link table has loaded successfully, and delete still refuses any prediction linked to a coupon.
- Prediction pagination, market filters, historical calculations, and all saved records remain unchanged. No database migration or data write is required.
- PR #75 merged to main as `ea82a03b4e0601150c8529726bc365d8eba46d41`. Corrected CI run #823 passed all steps (tests, TypeScript and build): https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43945359085.
- Cloudflare Main deploy run #410 passed all steps: https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/43945533638.
- Deployed production Worker version: `aac45b87-2a60-47a8-8c4b-c376e125b476` at https://moneyball-global.damianwalus3.workers.dev.
- No database migration or data writes were made.


## 2026-11-17 — MONEYBALL GLOBAL MAIN: import and scan pipeline repair
- Production remains Cloudflare Worker MAIN and branch `main`; do not switch to TEST or Vercel.
- OpenMatchday's technical folder IDs now supply explicit tier metadata. The public-source parser normalizes league/country labels while preserving the provider folder in the external ID. The manual sync, scheduled predictor and frontend use consistent European men's tier-1/tier-2 eligibility.
- The scheduled predictor now imports today's FootyNomad global feed and public-source fixtures into `matches` before the first prediction page, then deduplicates by Brussels date and ordered team pair. The scheduled response includes `scheduled_import` counters.
- Active Edge Function versions: `moneyball-public-sources v61`, `footynomad-sync v86`, `moneyball-predict v241`. Cloudflare deploy #685 and CI #1099 passed; 61 tests passed, including European league scope regressions. The scheduled importer logs `scheduled_import` JSON counters and requires explicit source/external ID metadata.
- OpenMatchday's current index has 75 competitions overall and only 38 eligible European domestic tier-1/tier-2 competitions. This is a source coverage ceiling, not complete Europe. Finding additional free, reliable sources for missing European first/second divisions remains open.
- Existing out-of-scope/historical rows were not deleted. The display and prediction filters exclude them.
- The 17 Nov 2026 runtime audit after the 08:00 Brussels scan is still pending; verify scheduled import counters, XGoalsPro cache writes, historical form usage, coverage delta, league scope and non-empty source/rationale before marking this repair validated.


## Live production verification — 2026-11-17 07:37 Europe/Brussels

- Corrected the interpretation of today's 265 legacy prediction rows: the out-of-scope examples (UEFA Nations League, Scotland Lowland League, France National 2 and ENG_7) were generated by older model versions before the current v241 scope/import repair. They are not evidence that v241 generated those picks. Preserve them as history.
- Production SQL helper `moneyball_is_european_top_two_league(country, competition)` was executed against every match whose kickoff falls on 17 Nov in Europe/Brussels. Result: 98 raw FootyNomad rows, exactly 2 eligible top-two domestic matches. No OpenMatchday rows currently in that day range. The two eligible rows are Warrenpoint Town–Glenavon FC and Rathfriland–Moyola Park (Northern Ireland Championship); both are present in `matches` and the feed.
- Frontend `mecze.tsx` applies `isEligibleEuropeanMatch` after Brussels-day filtering; Statistics and coupon candidate code also apply the shared European top-two helper. Existing out-of-scope prediction history is retained but excluded from the scoped views/summary logic. Do not delete old rows.
- Current time at audit: 07:37:24 Europe/Brussels. Prediction cron is active every minute but returns HTTP 200 with `skipped=true, reason=cooldown`, `next_scan_at=07:00 UTC` (08:00 Brussels). Scan state is still completed from the prior run; do not bypass the lease/cooldown. Today's scheduled importer has not yet emitted its `scheduled_import` metrics, so v241's actual scheduled import/prediction execution remains unverified.
- FootyNomad feed refresh is healthy: 2/2 fixtures, latest refresh 07:31 Brussels, no duplicates; feed records updated in cache and both fixtures already exist in `matches`. XGoalsPro cache currently has 2 fresh rows from 06:38 Brussels, plus 10 MONEYBALL_PUBLIC_AGGREGATOR rows. This confirms writes occurred, but the two eligible matches still need per-match coverage verification in the post-scan batch.
- Current runtime gate: do not declare the app fully working until the 08:00 scheduled batch produces `scheduled_import` JSON, processes both eligible fixtures, saves fresh source/rationale and reports prediction outcomes; then validate UI visibility, odds eligibility and the €4 ledger/coupon settlement path. No historical records were deleted or rewritten.


## Production repair — manual odds path and current source audit (2026-11-17)

- Fixed the manual odds promotion dead-end. The previous OddsForm promotion guard required `Number(prediction.confidence) >= 55`, while the current prediction engine intentionally stores `confidence: null` because model coverage is not calibrated confidence. A qualifying model pick rejected only for missing odds could therefore never be promoted by entering a manual price.
- Added `canPromoteManualOdds` with strict gates: rejected only for missing current odds; probability strictly above 75%; model_coverage >=55; at least 3 historical matches per team; non-baseline model source; nonempty data source and rationale; future scheduled fixture; eligible European men's top-two competition; valid selection; no reserve/youth team. Manual quote additionally requires a valid HTTP(S) source URL and capture time within the previous 6 hours. Unverified/stale entries are saved as MISSING and cannot qualify.
- Prediction function now persists `model_coverage` and `model_source_type` for 1X2/DC and GOALS rows, enabling the UI to evaluate manual prices against the actual model coverage. The same coverage metadata is not inferred from the confidence field.
- CI #1110 passed: Deno Edge Function type-check, 65/65 tests, TypeScript type-check and build. Cloudflare deploy #696 succeeded on branch main, commit `e339232717ca0d4db57a81caa84e1e1dffe0380c`. Public production Worker smoke fetch returned title MONEYBALL GLOBAL 2.0 and the expected €4 stake / 1X2, DC, Goals and settlement panel description (1.44 s fetch latency; this is not an authenticated UI interaction benchmark).
- Supabase production `moneyball-predict` deployed as ACTIVE v242 (`verify_jwt=false`, same as prior active config) from the same commit. Verify the next scheduled prediction batch writes the new coverage metadata before claiming the manual odds workflow is E2E complete.
- Correction on data semantics: XGoalsPro records for today's two eligible Northern Ireland Championship fixtures contain last-10 match results and goals-for/goals-against only; no `xg_for` / `xg_against` fields. They provide recent form, NOT measured xG. The model must report `xg_used=false` unless another source supplies actual xG. Do not label these records as xG observations.
- Odds provider remains a blocker for automatic pricing: MoviOdds key is not configured; provider_odds has 219,022 historic rows but 0 fresh unsuspended prematch quotes in the last 6 hours. Bwin/Kambi probe functions currently return 404. Bwin's published Sports API is a documented partner API, not a verified anonymous keyless feed. No scraping of bookmaker websites is to be added without explicit authorization. With the no-API-key project constraint, the validated manual price entry is the supported fallback; no automatic coupon should be generated without a fresh, sourced quote.
- Do not mark the whole app complete. The 08:00 Brussels scheduled scan still needs a live runtime audit: scheduled_import counters, two eligible fixtures, fresh prediction coverage, xG truth flags, current price availability, and coupon/bankroll integration.


## Additional hardening — manual odds URL validation and recurring audit (2026-11-17 07:50 Brussels)

- Manual odds form now blocks submission unless `source_url` is a syntactically valid HTTP(S) URL with a hostname, and shows a field-level error. This matches the promotion rule; previously it was only a visual label and a missing URL silently saved a non-qualifying quote.
- Latest code commit: `d57240977ef241e445139f5a260cdefdde95d79d`. Moneyball CI #1119 SUCCESS (Deno, tests, TS, build). Cloudflare deploy #705 SUCCESS (all deploy steps complete). The public Worker MAIN smoke fetch still serves MONEYBALL GLOBAL 2.0 and the €4 panel. The preceding complete code commit `c9fed7133353824415fe9ecad913a41fa610f1a0` also passed CI #1118 and deploy #704.
- Existing one-time post-scan audit automation was converted into a daily 08:15 Europe/Brussels audit starting 18 Nov 2026. Automation ID `6afbeb034e4c81919dd6ad7d554497e0`. It now checks scheduled_import metrics, strict Europe men's tier-1/2 filters, model coverage vs verified market, real xG semantics, odds freshness and source URL, €4 returns, coupon settlement/idempotency, CI/deploy and writes the audit into both project docs. Daily 08:00 Europe/Brussels fixture scan remains active.
- At 07:50 Brussels on 17 Nov, the 08:00 scheduled scan had not yet started; scan state still showed next_scan_at=07:00 UTC. Do not force it. Today's FootyNomad feed cache had 2 rows, 0 still NS/upcoming at that timestamp. Wait for the scheduled batch and inspect scheduled_import logs before judging runtime import.
- Live TipsAudit endpoint validated at 06:49 UTC: 292 global fixture records, including stale historical fair snapshots and current international fixtures. Fair odds are margin-removed market probabilities, not bookmaker payout prices. Feed attribution is required; PredictionsView already displays a visible TipsAudit link and clearly labels fair odds as not a bookmaker offer. Do not use fair odds as coupon odds. The two valid Northern Ireland domestic fixtures must still have a fresh real quote (provider or verified manual) before they can enter coupons.
- Bwin/Kambi probe Edge Functions are active but their source code intentionally returns HTTP 404; they are not usable feeds. MoviOdds sync is active but has no configured MOVIODDS_API_KEY. Do not scrape bookmaker pages or insert synthetic prices. Manual sourced quote remains the current supported fallback.
- Project remains in progress; do not claim full completion until the next scheduled scan and authenticated end-to-end workflows pass.


## Production audit continuation — 2026-11-17 08:00–08:05 Europe/Brussels

- Live database clock: 08:00:58 Brussels. Scheduled scan state for 2026-11-17 completed at 07:00:19 UTC (08:00:19 Brussels): status `completed`, 1 batch, 2 fixtures processed, no error, next scan 14:00 UTC (15:00 Brussels).
- Production `matches` contained 98 rows with a Brussels kickoff date of 2026-11-17. The production SQL helper `moneyball_is_european_top_two_league` plus `gender=men` classified exactly 2 as eligible: Warrenpoint Town–Glenavon FC and Rathfriland–Moyola Park (Northern Ireland Championship). The other 96 rows are out-of-scope feed records and remain preserved; do not delete them.
- Both eligible matches already had 1X2, DOUBLE_CHANCE and GOALS prediction rows (13 and 12 rows respectively), but every current pick was `ODRZUCONY`. Rejection reasons were either probability below the strict >75% candidate threshold or missing current confirmed odds. No valid coupon should be forced.
- `provider_odds`: 219,022 rows, latest capture 2026-11-16 02:11:13 UTC, 0 unsuspended quotes captured in the previous 6 hours. Automatic bookmaker odds remain unavailable.
- Prediction data confirms last-10 goals/results are present but real xG is not: `xg_used=false`, no historical xG sources; confirmed lineups and injury feeds are unavailable. Do not describe recent goals form as xG or invent squad information.
- Last-24h Edge Function logs at audit time: `moneyball-predict` 957 requests, avg 2.1 s, p95 4.6 s, max 30.5 s, 8 HTTP 5xx; `moneyball-results-sync` 287 requests, avg 7.5 s, p95 13.5 s, max 26.8 s, 0 5xx; `moneyball-free-feed` 98 requests, avg 2.1 s, p95 3.2 s, max 9.6 s, 0 5xx; `moneyball-movi-odds-sync` 14 requests, avg 0.8 s, p95 2.7 s, max 4.1 s, 3 5xx. Investigate predict 5xx and MoviOdds 5xx; results-sync latency is still a performance risk.
- Code audit found a scope inconsistency in Statistics: `fetchStatisticsPageData` and the Statistics route filtered with `isEuropeanTopTwoLeague(country, competition)` only, unlike the Matches view which also excludes explicit non-men gender and reserve/B teams. Fixed both layers to use the canonical `isEligibleEuropeanMatch(match)` helper:
  - `8f7f83074aca56be7ecf031aa5ba1109d3280d2a` — DB statistics query excludes non-eligible gender/reserve fixtures.
  - `6a408f8a7fe9b3352744de4e1ac58023fdd784c9` — Statistics UI uses the same strict fixture scope.
  - Existing `domain.test.ts` already contains the regression assertion that a women's fixture is rejected by `isEligibleEuropeanMatch`; the DB and UI now both consume that helper.
- Validation/deployment: GitHub combined status showed Vercel pending for the DB commit and Vercel build-rate-limit failure for the UI commit; this is not the production target. Available GitHub workflow lookup returned no PR-triggered runs for these commits. No CI success or Cloudflare deployment for these two commits is confirmed yet. Do not claim the fix is live until the correct Cloudflare CI/deploy workflow reports SUCCESS for the exact MAIN SHA.
- Version semantics: `MONEYBALL GLOBAL 3.8` is the prediction model version in source/UI; Supabase Edge Function deployment `v242` is a separate deployment revision, not a version mismatch.
- Remaining priorities: (1) verify CI and Cloudflare deploy for the statistics-scope fix; (2) investigate the 8 predict 5xx and 3 MoviOdds 5xx from logs; (3) reduce results-sync latency without risking settlement idempotency; (4) resolve automatic odds availability under the no-API-key constraint; (5) finish authenticated production E2E and scoped-query/performance work. Project remains IN PROGRESS.

## Public source authentication repair — 2026-11-17 08:10 Europe/Brussels

- The first live scheduled batch on Edge Function v242 logged `Public sources HTTP 401` twice. Root cause was confirmed from request logs: `moneyball-predict` used the new service/secret key as `Authorization: Bearer ...` when calling `moneyball-public-sources`, while that endpoint had `verify_jwt=true`. The gateway saw no valid JWT (`jwt_role=""`) and rejected the request before the public handler ran.
- The endpoint is genuinely public/read-only: its code only aggregates public fixtures, form, and Elo feeds; it does not read or return private user data. Deployed the unchanged aggregator as ACTIVE v62 with `verify_jwt=false`. This matches current Supabase guidance for public endpoints and service-to-service calls; see Supabase Authorization headers and Securing Edge Functions docs (updated 2026-10-22).
- Persisted the setting in new `supabase/config.toml`: `[functions.moneyball-public-sources] verify_jwt = false`. Config commit: `48e390e87ee68c2030641b6dfe1a609f4993abf4`.
- Removed the secret bearer token from the caller entirely: `readPublicSourceForms(date)` now sends only the publishable `apikey` header to this intentionally public endpoint. Removed unused `CRON_JWT_TOKEN` global. Source commit: `9d71b6e01e5f84f364eb41bb8fc8c464cf9094553`. Deployed `moneyball-predict` ACTIVE v243 with `verify_jwt=false` (cron token validation remains in the handler for scheduled work).
- Verification: public endpoint GET for 2026-11-17 returned HTTP success and JSON `ok=true`, `api_key_required=false`, `source_count=4`, `raw_fixtures=11`, `european_fixtures=8`. OpenMatchday checked 38 eligible league folders but returned 0 fixtures for that date; all 8 returned European rows had form, but 0 had Elo, true xG, lineups, injuries, or bookmaker odds. The aggregator is operational, but its coverage is not sufficient to claim full European domestic tier-1/2 coverage.
- The next scheduled batch at 15:00 Brussels must confirm that v243 calls v62 without 401 and logs `public_source_error=null`. Do not manually bypass cooldown or claim the new call path E2E-tested before that scheduled run.
- Historical 500s from Nov 16 came from old Edge versions 217/218 and included invalid cron token and permission denied for `moneyball_cron_owner_id`. They are not evidence of a current v243 failure; continue monitoring current versions separately.

## Statistics screen React hook-order hardening — 2026-11-17

- Static component review found `Statystyki` returned early for pending/error states before calling `useMemo` later in the function. This could change hook count between the initial loading render and the loaded render.
- Moved the memoized match index and safe empty-data defaults above all early returns. This preserves stable hook order while keeping the existing loading/error UI and statistics calculations.
- Commit: `e5fe44f5f61072c59603168694b12bfaaa3dc922`.
- Source was fetched back from GitHub and the hook now executes unconditionally before loading/error branches. Existing Vercel status reports a build-rate-limit failure; it does not confirm or refute the Cloudflare Worker deployment. No CI SUCCESS or Cloudflare deployment for this commit is confirmed yet.


## 2026-11-17 08:12–08:18 Brussels — independence, stake consistency and backend audit

### Independent application architecture — confirmed
- User reiterated that the application must be a separate, self-operating product. The requirement means: its own frontend/codebase/release URL on the existing Cloudflare Worker; no Lovable/no-code builder, no Vercel, no TEST deployment, no second app or second database, and no need to visit Supabase UI for ordinary use.
- The app's own backend remains the existing Supabase project `gzgeklcukrclgwbsmbsp` for Auth and Postgres. This is a standalone web product backed by its own Cloudflare Worker + existing Supabase project, not an offline/no-backend application.
- Added `docs/PROJECT_CONTEXT_INDEX.md` as a short durable index of relevant project conversation history, constraints, chronology and open work. Continue to read it together with this file and `PROJECT_MEMORY_AND_REGRESSION_LOG.md` before any new session/task. Do not claim access to every raw chat transcript; the index and project ledgers preserve the relevant decisions and verified work.
- README updated to make this independent architecture explicit.

### MoviOdds no-key guard
- `supabase/functions/moneyball-movi-odds-sync/index.ts` commit `08592e9dbd6c69e1c436d09773fed0b46eb2209b`: after validating the private cron token, if `MOVIODDS_API_KEY` is absent, return HTTP 200 with `ok:true, skipped:true` and an explicit reason, without calling MoviOdds or writing/deleting any odds.
- GitHub checks for that commit: Moneyball validate SUCCESS, GitHub deploy SUCCESS, Cloudflare Worker build SUCCESS. Supabase Edge Function is ACTIVE v7, `verify_jwt=false`.
- Live GET health returned `key_configured:false`, which confirms the no-key environment. The POST skip branch is deployed but was not directly exercised because the private cron token is not exposed to this audit. No fake odds were inserted.
- Previous MoviOdds 500s were from v5 on 16 Nov; v6 GET health returned 200. v7 now avoids the unnecessary provider request when no key exists.

### Fixed €4 stake — database and UI mismatch repaired
- Live schema audit found `public.predictions.stake` defaulted to `5.00`, even though the current product rule is €4 for newly selected singles and new coupons. The earlier 5 EUR migration had never been aligned with the newer 4 EUR application logic.
- Applied Supabase migration `20261117071516_align_moneyball_pick_stake_defaults_to_four_eur`: changed only the default to 4.00, aligned `moneyball_coupon_default_stake()` fallback to 4.00 and updated column comments. Verified live `information_schema.columns.column_default = 4.00`. No existing rows were updated.
- Added the exact migration file to the repo: `supabase/migrations/20261117071516_align_moneyball_pick_stake_defaults_to_four_eur.sql`.
- UI commit `2999e5efe8093dd82130464da3ae4ee542326f57`: manual promotion from ODRZUCONY to WYBRANY sets stake 4 and recalculates potential gross return from the stored odds.
- UI commit `26c790e0205a5dcde7e24064811b27cecf05c585`: manual creation sets stake 4; changing an old rejected pick to selected sets 4; editing an already selected historical pick preserves its existing stake. Potential return is recalculated only for a selected pick with odds >1.
- The newer combined branch commit `d521581b374fe77ba504a424bece485c768ad32d` includes these changes and the migration. Its CI validation completed SUCCESS (tests, Deno checks, TS, build); its Cloudflare deploy was still in progress at 08:17 Brussels. The subsequent context-index commit `26978d1b20de475269b3fe98864ba155f0e8e341` triggers a fresh production workflow; recheck the exact latest commit before claiming deployment.
- Live audit found 18,935 prediction rows. The 13 selected rows with stake 0 are old 16 Nov UEFA Nations League test picks (outside current domestic-league scope), with stored profit/loss 0; 17 selected rows with stake 5 are historical picks created 13–16 Nov. Coupons include old 5 EUR history and current 4 EUR records. Do not backfill/rewrite any of these historical records. The UI now sets 4 EUR for new promotions.
- Do not report E2E stake workflow complete until a newly created/promoted 4 EUR pick is tested through odds → settlement → stats and a new coupon is checked through ledger. Do not create fake production bets or fixtures for this test.

### Supabase security / performance advisor audit
- Project status ACTIVE_HEALTHY; health advisor returned no lints.
- Security advisor: five tables have RLS enabled and zero policies: `match_result_sources`, `moneyball_password_recovery`, `moneyball_prediction_scan_state`, `moneyball_reschedule_sync_state`, `project_work_log`. Live privilege check confirms anon/authenticated have no SELECT and service_role does. This is intentional service-only isolation, not a missing public policy; do not add permissive policies.
- Remaining security warnings: leaked-password protection is disabled; `pg_net` extension is in `public`. These require careful project-level/configuration work; no unsafe changes made.
- Performance advisor reports 24 unused indexes. Do not drop them based on one snapshot: many are newly added for query paths, and deleting them without representative production load/EXPLAIN evidence can reintroduce timeouts. Health advisor has no issues.
- Keep security/performance warnings in the open-work register and re-audit after stable workload.

### External technical references checked
- Supabase Authorization headers: https://supabase.com/docs/guides/functions/auth-headers
- Supabase Securing Edge Functions: https://supabase.com/docs/guides/functions/auth
- Supabase database indexes: https://supabase.com/docs/guides/database/postgres/indexes
- Cloudflare Workers deployment: https://developers.cloudflare.com/workers/wrangler/commands/workers/


## Release verification — 2026-11-17 08:19 Europe/Brussels

- Latest main commit at verification: `86874887068d9b8052df10fe547f08aab4f6d14a`.
- GitHub Actions Moneyball validate completed SUCCESS: run `44037653263` (Deno Edge Function check, tests, TypeScript, build). Cloudflare deploy completed SUCCESS: run `44037653210`. This is the first confirmed Cloudflare release containing the €4 database/UI changes, statistics scope/hook fixes, MoviOdds v7 no-key guard source changes in repo, and project context index.
- Post-deploy public smoke test: Worker root page HTTP-success and displays MONEYBALL GLOBAL 2.0 / €4; `/login` renders the login form; `/panel` returns `login_required` for unauthenticated access. This confirms public shell, login route and protected-route gate only. Authenticated click-through/E2E is still untested.
- Supabase current active versions: `moneyball-public-sources v62`, `moneyball-predict v243`, `moneyball-movi-odds-sync v7`; the latter's health endpoint reports `key_configured=false`. The 15:00 Brussels scheduled scan is still required to prove the v243→v62 service call has `public_source_error=null` and no 401.
- Supabase advisors were rerun after the migration. Health: no lints. Security warnings unchanged (five service-only RLS tables with no policies, pg_net in public, leaked-password protection disabled). Performance: 24 unused-index INFO findings. No unsafe policy or index changes were made.
- Continuity: existing daily audit automation `6afbeb034e4c81919dd6ad7d554497e0` was updated to read `PROJECT_CONTEXT_INDEX.md`, `PROJECT_STATE.md`, `PROJECT_MEMORY_AND_REGRESSION_LOG.md`, README and recent MAIN state before every run, recover prior project decisions when available, and avoid repeating completed work. It remains daily 08:15 Europe/Brussels, next run 18 Nov 2026.
- Project remains IN PROGRESS until the authenticated user workflows and next scheduled import are verified. No production fixture/pick/coupon was fabricated to test finance.


## Free-source coverage verification — 2026-11-17 08:20 Brussels

- Cross-checked the low 17 Nov domestic fixture count against additional public sources before treating it as an import defect:
  - OpenFootball football.json current 2026/27 directory exposes only eight league files: England tiers 1 and 2, Germany tier 1, Spain tier 1, France tier 1, Italy tier 1, Netherlands tier 1, Portugal tier 1. It does not provide broad Europe-wide second-tier coverage. The checked 2026/27 files had no fixtures dated 2026-11-17. The project FAQ explicitly warns upstream Football.TXT is not automatically updated daily; football.json refreshes its mirror daily but cannot guarantee fresh upstream content. Use only as a low-priority schedule fallback with source freshness metadata, never as a live status/odds/xG source.
  - TheSportsDB free v1 documentation states shared public key 123, 30 requests/minute and endpoint-specific caps; `eventsday` has a free limit of 3. A direct 2026-11-17 soccer day request returned exactly 3 UEFA Nations League events (Wales–Portugal, Denmark–Norway, Ukraine–Georgia), not domestic league fixtures. It is unsuitable as a full global fixture source under free limits. It remains useful for selected result enrichment only.
  - OpenMatchday's 75 competitions / daily CSV data is free for non-commercial use; current project parser checked 38 eligible EU tier-1/2 folders and returned no fixture for 17 Nov.
  - FootyNomad returned two eligible domestic fixtures for 17 Nov. Because this date is within a national-team window and independent sources checked also show no major top-tier fixtures, the two domestic matches may be a legitimate sparse day. Do not inflate counts with UEFA/national-team/cup/out-of-scope fixtures. Keep a coverage warning and continue scheduled audits for missed domestic leagues.
- Source references:
  - OpenFootball Europe datasets: https://github.com/openfootball/europe
  - OpenFootball football.json and update caveat: https://github.com/openfootball/football.json
  - OpenMatchday coverage and license: https://github.com/oladeeayo/open-matchday
  - TheSportsDB official free API limits and schedule docs: https://www.thesportsdb.com/API.php and https://www.thesportsdb.com/docs/api
- No new fixture adapter was added: current source checks do not justify an unverified feed integration.


## 2026-11-17 08:33 Brussels — single pick, coupon integrity, ledger and runtime performance

### Single-pick save flow restored
- Found a genuine dead-end: Mecze.tsx exposed saveSingleBet and passed targetLegs:1, but saveCouponBatch rejected every target except 3; the database trigger also unconditionally forced 3 legs. The UI also omitted recordStake:true, so pending single stakes would not immediately appear in the bankroll.
- Fixed src/lib/coupons.ts to accept only 1 or 3 legs (the existing validateBatch validates exact size, >75% probability, unique matches, and fresh confirmed odds for MAIN/MEGA/EXTRA).
- Fixed src/routes/_authenticated/mecze.tsx to save single picks as MAIN with exactly 1 leg, EUR 4 stake, fresh odds, and recordStake:true.
- Added a unit test for one-leg validation and mandatory real odds.
- Applied migration 20261117073215_allow_four_euro_main_single_pick_coupons: database trigger now permits target_legs=1 only for coupon_type MAIN; all coupon types may use 3 legs; every new coupon remains fixed at EUR 4. The existing moneyball_reconcile_coupon_finance and moneyball_coupon_finance_summary already correctly support both 1- and 3-leg coupons.
- Verified with production rollback-only SQL integration tests:
  - MAIN single: inserted one leg, forced stake EUR 4 even when test supplied EUR 5, settled won, wrote exactly one stake EUR 4 and one return EUR 7.20 at odds 1.80; all test writes rolled back.
  - Three-leg MAIN: three distinct matches, odds 1.10 × 1.20 × 1.30, settled won, wrote exactly one stake EUR 4 and one return EUR 6.86; all test writes rolled back.
  - Duplicate-match insertion into the same coupon was rejected by the database unique index; test writes rolled back.
  - Verified zero test coupon, leg or ledger rows remained after both tests.
- Production code commit 16348bb506953e70891d57901372023f8034e5d4: Moneyball validate SUCCESS (Deno Edge checks, tests, TS, build), GitHub Cloudflare deploy SUCCESS, Cloudflare Workers Build SUCCESS.
- Post-deploy Worker smoke: root 200 and title MONEYBALL GLOBAL 2.0, /login renders login form, /panel returns login_required unauthenticated. Root 98ms, login 75ms in this smoke. Authenticated UI click-through still not tested.

### Coupon and bankroll audit — corrected SQL fan-out false alarm
- Initial aggregate joined coupon_legs and bankroll_transactions directly (two one-to-many tables), inflating counts. This was a query fan-out error, not duplicate production data. No data was modified.
- Re-ran with separate pre-aggregated CTEs. Current 3-leg MAIN coupons each have exactly 3 legs, 3 distinct matches/predictions, one stake transaction and one return transaction. The single-pick historical MAIN coupon has exactly 1 leg, one stake and one return. No duplicate coupon-match groups and no null match IDs before the new constraint.
- Current EUR 4 three-leg coupons: #1 stake 4 / return 4.36; #2 stake 4 / return 6.07. Historical EUR 5 records and zero-stake TEST records remain unchanged.
- Bankroll: 9 transactions; initial deposit EUR 91.60, total stakes EUR 23.00, total returns EUR 15.68; balance EUR 84.28. Window-function audit found 0 balance_after mismatches. No duplicate stake/return transaction per coupon; existing unique indexes remain in place.
- One old test coupon MONEYBALL AUTO TEST 2026-11-12 is marked won but has no odds/potential return; finance summary correctly treats its payout as incomplete. It is a historical TEST record, not a real bet. Preserve it and do not invent a payout.

### Coupon leg database integrity
- Existing code-level validateCoupon already rejected duplicate matches, but database lacked a matching invariant.
- Applied migration 20261117072931_enforce_unique_match_per_coupon_leg: coupon_legs.match_id is now NOT NULL and unique index coupon_legs_unique_coupon_match_idx(coupon_id,match_id) prevents the same match appearing twice in one coupon. Existing data had 0 null match IDs and 0 duplicate coupon/match groups. No rows changed.
- The table already restricts leg_number to 1–3 and unique (coupon_id,leg_number), so at most 3 legs can exist; finance RPC leaves incomplete coupons pending when actual leg count differs from target.

### Results-sync performance optimization (v72)
- Commit 7f0cdffc2b7997da986229432ff341c4a712060c parallelized independent timed-match and date-only PostgREST reads in both the discovery and alternate-results paths.
- Deployed moneyball-results-sync v72. Three observed HTTP 200 runtime samples: 5.268s (reschedule lease due), 3.887s and 4.379s (reschedule skipped). No errors; alternate feed matched 3 observations and financial reconciliation checked 7 coupons with 0 failures.
- Before fix v71 (24h): median 4.594s, p95 8.76s, max 13.55s. Internal discovery improved from 2.273s sequential to 0.113–0.134s parallel; main match load observed 0.269–0.736s. Overall sample is still small; continue monitoring, do not claim total latency solved.

### Remaining
- Authenticated production UI E2E is still outstanding: save single → verify pending bankroll stake → settle → verify return/profit and statistics; save 3-leg MAIN → verify settlement. Database rollback-only tests prove SQL triggers/RPC, not browser interaction.
- Next scheduled scan at 15:00 Brussels must verify moneyball-predict v243 calls moneyball-public-sources v62 with no 401 and public_source_error=null.
- Continue monitoring European domestic tier 1/2 feed coverage, fresh real bookmaker odds, true xG and confirmed lineups.
- Security warnings remain: leaked-password protection disabled; pg_net extension in public. RLS service-only tables have no policies and no anon/authenticated SELECT; keep them private.


## Final single-flow guard verification — 2026-11-17 08:42 Brussels
- A follow-up frontend guard was added so target_legs=1 is accepted only when coupon_type=MAIN, matching the database trigger. Commit 2044f44 initially failed TypeScript because the guard referenced an out-of-scope couponType variable; CI correctly caught TS2304 before deployment. Fixed immediately to options.couponType in commit a5eb5dbfbd1f6b682aa198aeebb1b8ba10c12d2c.
- Final checks for a5eb5db: Deno Edge type-check SUCCESS, 67/67 unit tests SUCCESS, TypeScript SUCCESS, build SUCCESS, GitHub Cloudflare deploy SUCCESS, Cloudflare Workers Build SUCCESS.
- Post-deploy production smoke: root page and login page both load; /panel correctly requires login when unauthenticated. This confirms the latest deployed frontend shell and route guard. Authenticated workflow remains pending.
- Existing daily audit automation 6afbeb034e4c81919dd6ad7d554497e0 was updated again at 08:41 Brussels: explicitly distinguishes MAIN single target_legs=1 from 3-leg AKO, verifies recordStake=true, one stake/one return, database unique match guard, and avoids SQL join fan-out by pre-aggregating legs and ledger separately. Schedule remains daily 08:15 Europe/Brussels; next run 18 Nov 2026.


## Results-sync v72 follow-up sample — 2026-11-17 08:45 Brussels
- Fourth observed v72 production request returned HTTP 200 in 3.249s.
- Reschedule reconciliation skipped in 80ms; parallel discovery 207ms; ESPN selection 53ms; TheSportsDB 22ms; OpenMatchday 67ms; alternate total 353ms; main match load 343ms; financial reconciliation checked 7 coupons in 128ms with 0 failures.
- 173 FootyNomad fixtures fetched, 3 alternate observations matched/persisted, 0 results matched/saved and 0 predictions/coupon legs settled. No error; absence of settlement reflects no new verified result for the currently due matches, not a failed sync.
- This is a fourth sample only; retain monitoring and compare p50/p95 after a full 24h on v72.

## Production repair checkpoint — 2026-11-17 08:15–08:30 UTC

### Source authorization and prediction scan
- Root cause of the two public-source HTTP 401s at 07:00:05 UTC was Supabase rejecting conflicting API keys: apikey used the publishable key while Authorization carried a secret key. The final fix in commit bb9bf0d4d569319f262501c71df925558ce35a75 explicitly sends matching keys in both headers from the server-side moneyball-predict function. Supabase Edge Function version 245 deployed.
- Direct pg_net request with the exact matching headers returned HTTP 200, source_count=4, raw_fixtures=11, european_fixtures=8, and form coverage for 8/8 fixtures. After the fix, scheduled_import logged public_source_error=null.
- Manual prediction scan previously paginated raw matches before eligibility filtering. The two eligible fixtures were at raw row positions 80 and 94 of 99, so the first 8 pages were empty and the client had to traverse out-of-scope rows.
- Added owner-scoped RPC moneyball_manual_prediction_scan_page(date, integer, integer) in migration 20261117090000_add_authenticated_manual_prediction_scan_page.sql (commit 9d9c621ed2f59679877becb2ab17e232f6fa2cb9). Manual branch in moneyball-predict now uses this RPC (commit bf4a797f91649ee34f51aa6cf274add939969b66); Supabase Edge Function version 246 deployed.
- RPC test with the actual owner context returned 2 rows, count=2, has_more=false. Cross-owner test returned 0 rows. RPC does not accept owner_id from the client and derives it from auth.uid().
- Re-run of today's scheduled scan on version 246 completed successfully: matches=2, predictions=24, updated=24, covered=2, missing=0, selected=0, couponCreated=false. Import metrics: feed_rows=2, public_rows=8, eligible_rows=2, inserted=0, skipped_existing=2, feed_error=null, public_source_error=null. Next scheduled scan remains 15:00 Europe/Brussels.

### Scope predicate and regression fixes
- Shared eligibility helper did not reject named reserve teams such as Real Madrid Castilla, Celta Fortuna, Valencia Mestalla, Betis Deportivo and Sevilla Atletico. Added these exclusions to moneyball_is_eligible_european_match in migration 20261117093000_exclude_named_reserve_sides_from_shared_eligibility.sql (commit 264726ce3ef40c04b3f2b03a8cb4ae74f5c30539).
- SQL alias audit found a prefix-match bug: NB III could match the NB I/NB II aliases in moneyball_is_european_top_two_league. Added a negative rule for roman numeral tier III+ aliases in migration 20261117094000_exclude_hungarian_third_tier_nb_iii.sql (commits d42089df130bbab04f84af35fe3ff6783fe58383 and cdd5be949dbe8ac4b2ba943f5c96f097a12e2722).
- Regression checks: NB I and NB II remain allowed; NB III, NB IV and Romania Liga III are rejected. Named Spanish reserve teams are rejected by the shared helper. The 100+ tested expected European tier-one/tier-two labels remained accepted; issue #77 remains open pending the complete source-catalogue comparison.
- Frontend regression tests for NB I/II vs NB III/IV and named reserve teams added in commit e82719edd24d9fcdf8cc7953ad83e76dd8380632.

### Coupon finance and bankroll audit
- Finance summary previously counted a zero-stake test coupon with unknown odds as an incomplete financial settlement. Migration 20261117100000_ignore_zero_stake_coupons_in_finance_summary.sql (commit 5658bacaeb8079df9e691635aee523286010f39b) now treats stake=0 as payout=0 for financial aggregation.
- Finance summary now has one incomplete historical coupon, not two: a 5 EUR test coupon marked won but with no recorded odds/potential return. Do not invent or backfill a payout without verified historical odds.
- Ledger audit: opening deposit 91.60 EUR, total stakes 23.00 EUR, recorded returns 15.68 EUR, current ledger balance 84.28 EUR; no duplicate coupon transactions and no balance_after mismatches. The incomplete historical 5 EUR coupon has no recorded return, so final historical net remains incomplete. New coupons retain the 4 EUR rule; historical 5 EUR stakes are not rewritten.

### Production verification and remaining blockers
- GitHub CI run 44046719711 and Cloudflare deploy run 44046719759 for commit e82719ed: SUCCESS.
- Public Worker root and /login load. /panel correctly returns login_required to an unauthenticated browser; no authenticated user session was available, so logged-in UI/E2E is still unverified.
- Production logs 00:00–09:00 UTC: moneyball-predict v246 7 requests, all HTTP 200 (avg 2.76s, p95 7.06s, max 9.17s); moneyball-results-sync v72 13 requests, all HTTP 200 (avg 5.05s, p95 7.87s, max 8.83s); moneyball-free-feed v42 14 requests, all HTTP 200; moneyball-public-sources v62 10 requests, all HTTP 200; MoviOdds v7 5 requests, all HTTP 200/skipped because no key. The two 401s occurred before the auth fix at 07:00:05 UTC; no v246 public-source 401 or 5xx was observed in the post-fix scan.
- Today's Brussels scope: FootyNomad reports 173 total fixtures; DB contains 99 rows for today, only 2 meet the actual Europe domestic senior men's tier 1/2 rule. The other source entries include international competitions, cups, youth, reserves and lower tiers. Do not treat 173 as 173 eligible fixtures.
- Fresh odds remain unavailable: 0 active provider_odds records in the last 6 hours; latest stored MoviOdds capture 2026-11-16 02:11:13 UTC. MoviOdds requires an API key and Bwin partner API access is restricted. Do not use stale, synthetic or non-Belgian prices as current bookmaker odds. MAIN/MEGA/EXTRA remain blocked until a verified current odds source is available.
- Do not close issue #77, claim full league coverage, or declare the complete project finished. No Vercel/TEST deployment, no historical data deletion, no real-money betting.

## Statistics performance and financial-field repair — 2026-11-17 08:32–08:38 UTC

- Statistics page previously fetched all 2,596 historical match rows, all coupons/legs, then active-model predictions in multiple per-match-ID chunks. The page needed only eligible European senior tier 1/2 matches and active-model predictions.
- Added owner-scoped SECURITY DEFINER RPC moneyball_statistics_page_data() in migration 20261117103000_add_owner_scoped_statistics_page_rpc.sql; then compacted its JSON payload in 20261117104500_compact_statistics_page_payload.sql and included the rationale required by the detail drawer in 20261117110000_include_rationale_in_statistics_payload.sql.
- The RPC returns only eligible matches, active MONEYBALL GLOBAL 3.8/MANUAL predictions, coupons whose every leg belongs to an eligible match, and those legs. It also joins verified match_results for home_score/away_score. It includes stored prediction stake, potential_return, profit_loss and rationale, but omits bulky note/data_coverage metadata.
- Owner-context SQL test: 374 eligible matches, 1,321 active predictions, 1 scoped coupon, 3 legs; JSON payload 798,520 bytes. The initial compact payload without rationale was 598,586 bytes. Earlier broad payload was 5,185,440 bytes. Final payload is about 84.6% smaller than the broad version and returned in about 1.7 seconds in the SQL test.
- Security tests: anon/public do not have EXECUTE; authenticated does. A different owner UUID receives 0 matches, 0 predictions, 0 coupons and 0 legs.
- Frontend db.ts now uses the single RPC. Statistics types are narrowed to the exact fields used by the page. schema.ts adds predictions.stake/potential_return/profit_loss and coupon_legs.match_id to canonical read columns; coupon-leg adapter preserves the database match_id. Stats page now receives verified scores and actual stored stake/P&L rather than defaulting to 4 EUR when historical stake differs.
- Regression tests added in src/lib/schema.test.ts. The pre-existing schema contract test was updated because coupon_legs.match_id became canonical in migration 20261117072931. Type-check initially caught that the stats detail drawer also renders prediction.rationale; the RPC and StatisticsPrediction type were corrected to include it.
- Final code commit 99b90fa73580bff38750fa46358d896680abe705: CI run 44048281991 SUCCESS; Cloudflare deploy run 44048281920 SUCCESS. Earlier intermediate CI failures were corrected; do not treat them as current failures.
- Production root and /login smoke test succeeded after deployment; /panel remains login-protected. No authenticated UI session was available, so the statistics page itself has not been clicked through in a logged-in browser.
- Remaining full-history operations: bankroll page reads its small ledger/coupon tables; saveCouponBatch, cancelCoupon and client settlement reconciliation still read the full bankroll ledger. Current ledger has 9 transactions and 9 coupons. Do not refactor financial settlement/cancellation without a rollback-only regression test; the existing server-side moneyball_reconcile_coupon_finance RPC is service_role-only and must not be called directly from the browser.

### Current unresolved blockers remain
- The 15:00 Europe/Brussels scan still needs its post-run audit.
- Issue #77 remains open pending a complete country-by-country FootyNomad catalogue comparison and authenticated MAIN UI verification.
- Fresh odds are still unavailable without an approved no-key source or user approval for a free provider key. MAIN/MEGA/EXTRA remain blocked; no stale or synthetic prices.
- One historical 5 EUR TEST coupon marked won still has no recorded odds/payout; keep it financially incomplete rather than inventing a return.
- Project is not complete. Do not deploy Vercel or TEST.

## Atomic coupon finance, exact odds and source research — 2026-11-17 08:45–08:52 UTC

### Owner-scoped financial operations deployed
- Migration 20261117084010_owner_scoped_coupon_finance_rpcs created:
  - `moneyball_reconcile_coupon_finance_for_owner(p_coupon_id)`: authenticated owner check, then invokes the existing service-role-only reconciliation function.
  - `moneyball_cancel_coupon_for_owner(p_coupon_id)`: atomic owner-scoped cancellation, voids legs, refunds an existing stake once, and rebuilds ledger balances in one transaction.
- Frontend `settlement.ts` no longer fetches the full bankroll ledger and recalculates every row after settlement. It calls the owner-scoped reconciliation RPC after leg updates.
- Frontend `coupons.ts::cancelCoupon` now calls the atomic cancellation RPC instead of downloading all coupons, legs and transactions and updating balances client-side.
- Security: authenticated can execute both wrappers; anon cannot. Cross-owner calls to both wrappers were tested and denied.
- Rollback-only SQL test passed: pending 3-leg coupon → won; repeated reconcile creates exactly one stake and one return; cancellation refunds exactly once; ledger balance is rebuilt. Test coupons/transactions were rolled back and confirmed absent afterward.

### Exact odds and payout calculation
- Migration 20261117084525_align_coupon_odds_precision_and_payout aligns the reconciliation function with the finance summary: combined odds stored/displayed to 3 decimals; payout is calculated from the unrounded product of individual leg odds and rounded only to cents.
- Migration 20261117084559_handle_void_legs_in_coupon_price_trigger makes the coupon-price trigger treat void legs as odds 1.00 and use the same exact payout rule.
- Frontend `totalOdds` and `effectiveOdds` now use 3-decimal combined odds. `couponPayout` calculates stake × exact active-leg odds, then rounds the cash return to cents.
- Regression case: 1.100 × 1.182 × 1.167 = 1.517 displayed odds; 4 EUR stake pays 6.07 EUR, not 6.08 EUR. Both SQL rollback-only tests and the new domain unit test cover this.
- Price-trigger rollback test passed: inserting the three legs immediately stores combined_odds=1.517 and potential_return=6.07.
- This fixes the former one-cent mismatch between the client calculation and the database finance summary.

### Current bankroll / finance snapshot after all rollback tests
- 9 bankroll transactions, 9 coupons, latest balance_after = 84.28 EUR. All rollback-only tests left production balances and records unchanged.
- Finance summary: all history count=7, stake=23 EUR, payout=15.68 EUR, incomplete=1, net=NULL. Two zero-stake legacy test coupons are excluded from financial totals.
- Week: count=3, stake=13 EUR, payout=15.68 EUR, net=+2.68 EUR.
- MAIN: 1 coupon, stake=5 EUR, payout=5.25 EUR, net=+0.25 EUR.
- TEST: 6 coupons, stake=18 EUR, payout=10.43 EUR, incomplete=1; net remains NULL because historical coupon `MONEYBALL AUTO TEST 2026-11-12` is marked won but has no odds/payout. Do not invent a payout or rewrite historical stake.

### Public odds-source research — no compliant replacement found
- Tested TipsAudit's public `GET /api/v1/predictions` from production Supabase via `net.http_get`; HTTP 200, generated_at 2026-11-17 08:48:39 UTC, 292 upcoming matches, 284 fresh fair-price records, 3 soft-value quotes.
- Today's 9 entries were one Ukraine Persha Liga reserve-side fixture and eight UEFA Nations League matches; none matched our domestic European senior tier 1/2 scope. The only today's soft quote was 1xBet (not a Belgian bookmaker) and only a 0.64% monitor signal. The API provides mainly 1X2 fair odds, not a complete current Belgian bookmaker board for 1X2/DC/GOALS.
- Official TipsAudit terms say free without API key, 60 requests/minute, ~5-minute prediction refresh, but require visible attribution. It is potentially a secondary 1X2 fair-market benchmark only, not a bookmaker price source and not sufficient for coupons.
- A Flashscore-derived Apify actor advertises no key/login but charges from $0.79 per 1,000 matches; it is paid and scrapes Flashscore, so do not use under the user's no-paid-source constraint without explicit approval.
- football-data.co.uk is historical, not a live bookmaker feed, and its terms are not suitable for automated app scraping. Bwin partner API still returned 403/partner access required; MoviOdds returned 401 without a key.
- Therefore there is still no verified free, no-key, permitted source covering the required Belgian bookmaker prices and markets. MAIN/MEGA/EXTRA must remain blocked when prices are not fresh; never substitute fair odds, old detected prices or synthetic prices for current bookmaker odds.

### Deployment / remaining verification
- Latest commit: ee8e6eb1 (odds precision and void-leg trigger). GitHub CI run 44049531490 SUCCESS; Cloudflare production deploy run 44049531394 SUCCESS.
- Production Worker root and login were reachable after the earlier frontend deployment; /panel remains login-protected. No authenticated browser session was available, so do not claim logged-in end-to-end UI verification.
- Latest current balance remains 84.28 EUR. The project is not complete.

### Remaining blockers
1. Verify the 15:00 Europe/Brussels scan and its source/error/prediction counts.
2. Keep issue #77 open until the full country-by-country FootyNomad tier 1/2 catalogue and authenticated MAIN UI have been verified.
3. Find a compliant fresh odds source or obtain explicit approval for a free key/paid feed. Until then no MAIN/MEGA/EXTRA coupon from stale prices.
4. Complete authenticated end-to-end scan → coupon → result → bankroll → statistics test in the user's existing session.
5. Remaining small full-table reads are limited to Bankroll display and saveCouponBatch balance lookup; settlement and cancellation no longer read the full ledger.

## European league catalogue and eligibility regression audit — 2026-11-17 10:01 Europe/Brussels

### Source catalogue evidence (not a completion claim)
- UEFA's official association directory lists 55 member associations: https://www.uefa.com/nationalassociations/
- OpenMatchday 2026/27 LEAGUE_INDEX contains 48 tier-1/tier-2 rows globally, of which 38 are European domestic rows across 29 UEFA member countries (28 tier-1 rows and 10 tier-2 rows; Ireland appears as tier 2 only). It is free/no API key and updated daily, but its README limits the compilation to informational non-commercial use with attribution; it is not live and has no xG, lineups, injuries or odds: https://github.com/oladeeayo/open-matchday
- FootyNomad's current /browse snapshot exposed 13 European country sections and 26 tier-1/tier-2 competition labels. All 13 are within OpenMatchday's 29-country set. The same-day /fixtures/2026-11-17 page reports 173 matches across 20 countries and includes two Northern Ireland Championship fixtures, although Northern Ireland is absent from the visible /browse country list. Treat this as a directory inconsistency; do not treat /browse as a complete authoritative country catalogue.
- ESPN's current domestic league code list covers 16 countries, all already represented in OpenMatchday's 29-country set; it adds no new country coverage. OpenLigaDB adds Germany only. TheSportsDB did not add a new domestic tier-1/tier-2 country in the tested day sample.
- Current combined source evidence: at least one national domestic tier-1 or tier-2 source is visible for 30/55 UEFA associations; tier 1 for 28, tier 2 for 19, and both tiers for 17. This is catalogue evidence, not proof of full fixture availability or complete coverage of both tiers in all 30 countries.
- 25 UEFA associations have no verified tier-1/tier-2 national domestic fixture source in the current source catalogues: Albania, Andorra, Armenia, Azerbaijan, Belarus, Bosnia and Herzegovina, Bulgaria, Estonia, Faroe Islands, Georgia, Gibraltar, Hungary, Iceland, Israel, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Montenegro, North Macedonia, San Marino and Serbia.
- OpenFootball Europe has current 2026/27 text files for Czechia, France, Greece, Netherlands, Portugal, Scotland, Switzerland and Turkey; these countries are already represented by OpenMatchday, so this snapshot adds no new country coverage. The football.json mirror's latest commit was 2026-09-22 and is too stale to trust as a current-day source without a freshness check: https://github.com/openfootball/europe and https://github.com/openfootball/football.json
- On 2026-11-17, moneyball-public-sources returned 11 raw fixtures, 8 classified as European and 8 unique. The 8 European fixtures were UEFA Nations League/international fixtures, not domestic leagues. OpenMatchday checked 38 European competitions and returned 0 fixtures; ESPN returned 8 international fixtures; OpenLigaDB returned 0; TheSportsDB returned 3 non-qualifying events. The public-source aggregator's european_fixtures field is not the same as domestic tier-1/tier-2 eligibility.
- Production DB day snapshot: 110 rows across sources, 2 pass the shared domestic senior-men tier-1/tier-2 predicate, 1,321 active model predictions. The 99 FootyNomad rows include 2 eligible Northern Ireland Championship matches and 97 out-of-scope rows retained for history/audit; do not delete them.
- The 13 FootyNomad browse countries and 26 league labels were tested against production SQL. Before this repair, three false positives passed: Italy 'Serie D - Championship Round' (4th tier matched generic 'championship'), Sweden 'Damallsvenskan' (women's league matched the 'allsvenskan' substring and the name was not recognized by the importer gender detector), and England 'Premier League - Summer Series' (special exhibition matched generic 'premier league').

### Scope-filter repair and regression results
- Code commit b02709f63e4b141ada5fb025b8b30a1b3f1ed9e9 updated src/lib/domain.ts, src/lib/domain.test.ts, supabase/functions/footynomad-sync/index.ts, supabase/functions/moneyball-free-feed/index.ts and supabase/functions/moneyball-public-sources/index.ts. It explicitly rejects Serie D, Damallsvenskan, WSL/Liga F and Summer Series, and recognizes those women's league labels in importer gender detection.
- Migration file supabase/migrations/20261117124000_exclude_serie_d_womens_and_summer_series.sql (migration applied successfully; migration-file correction commit f15a2a985e30b6e2c85f0ae60562a73ebe2b7971) updates production moneyball_is_european_top_two_league and moneyball_is_eligible_european_match with the same exclusions.
- SQL regression test: 12/12 cases passed. Valid controls retained: Italy Serie A/B, England Premier League/Championship, Sweden Allsvenskan/Superettan, Belgium Jupiler/Challenger Pro. All three false positives now return false from both production predicates, including Damallsvenskan when gender is NULL.
- Re-evaluating all 634 FootyNomad browse labels now leaves exactly the expected 26 accepted tier-1/tier-2 labels across the 13 country sections; the three false positives are no longer accepted.
- Production Supabase Edge Functions deployed with JWT settings preserved: moneyball-public-sources v63 (verify_jwt=false), footynomad-sync v87 (true), moneyball-free-feed v43 (true). Post-deploy public-source v63 logs: 3 HTTP 200 calls in 2.375s, 3.873s and 3.965s; no error. footynomad-sync v87 and moneyball-free-feed v43 have not yet been exercised by a post-deploy scheduled import; verify at the next 15:00 Europe/Brussels scan.
- GitHub CI run 44051320905 SUCCESS and Cloudflare Worker deploy run 44051320954 SUCCESS for commit f15a2a985e30b6e2c85f0ae60562a73ebe2b7971. Earlier intermediate deploy runs were cancelled because a newer commit superseded them; final run is SUCCESS.
- Production Worker root and /login load. /panel correctly returns login_required without a user session; authenticated UI verification remains outstanding.
- Finance rollback-only integration test passed after the new owner-scoped RPC changes: 3-leg coupon at EUR 4, odds 1.50×1.60×1.55 = 3.72, potential return/payout EUR 14.88, one stake and one return only, repeat reconciliation idempotent, cancellation refunds EUR 4 and rebuilds the same ledger balance. Transaction rolled back: 0 test coupons and 0 test transactions remain. Real ledger remains EUR 84.28 with 9 transactions and 9 coupons.

### Remaining blockers and next steps
1. Keep issue #77 OPEN. Build a source-by-source, country-by-country catalogue for the 25 missing associations and add only verified, current, legally usable no-key feeds. Do not invent fixtures or infer a league from country membership.
2. Verify the 15:00 Europe/Brussels scan after Edge Function versions 87/43/63: importer errors, source counts, eligible matches, predictions, deduplication and result sync.
3. Complete authenticated MAIN UI E2E in an existing user session. No password or fabricated identity.
4. Fresh Belgian bookmaker odds remain unavailable from current no-key sources. Do not create MAIN/MEGA/EXTRA from stale/fair/synthetic odds; no real-money betting.
5. Project is not complete. Do not close issue #77, deploy Vercel/TEST, delete historical rows or rewrite historical finance.

## Football Charts provider evaluation and restricted fallback — 2026-11-17 10:20 Europe/Brussels

### Provider facts verified
- Official docs: https://www.football-charts.com/developers ; API base https://footballcharts-backend.onrender.com/api/v1.
- API catalogue: 98 leagues in 44 countries; 31 UEFA associations in the European subset.
- Free no-key tier: 25 requests/day per IP, 20/min. Free key: 200/day after email confirmation, but MONEYBALL does not use a key.
- API updates once daily after overnight run, about 06:00 UTC; fixture endpoint returns upcoming fixtures for the next few days, with no date parameter.
- Free plan is for personal/private projects with attribution. If other people use the app/site/bot, Commercial plan is required. Raw API responses/data may not be redistributed. Terms: https://www.football-charts.com/terms
- No free-tier odds or per-match xG/shots/pass stats. Provider model predictions are deliberately discarded.

### Coverage gain
- Seven previously uncovered UEFA associations gain a tier-1/2 catalogue source: Azerbaijan, Bulgaria, Estonia, Hungary, Latvia, Lithuania and Serbia.
- Combined catalogue evidence rises from 30/55 to at least 37/55. The 18 remaining associations without a verified current tier-1/2 national domestic source: Albania, Andorra, Armenia, Belarus, Bosnia and Herzegovina, Faroe Islands, Georgia, Gibraltar, Iceland, Israel, Kosovo, Liechtenstein, Luxembourg, Malta, Moldova, Montenegro, North Macedonia and San Marino.
- Only eight league IDs are allowlisted: azer, bulgaria1, estonia, hungary1, hungary2, latvia, lithuania, serbia1. Women's, youth, third-tier, regional and exhibition competitions are excluded.
- All eight fixture endpoints returned valid JSON. The 17 Nov sample had no same-day fixture among these eight; upcoming fixtures were present for 20–23 Nov in Bulgaria/Azerbaijan/Hungary/Serbia, Hungary II on 21–22 Nov, next-known dates 21 Nov Lithuania and 22 Nov Estonia; Latvia had no fixture in the next three days. This is endpoint validation, not a completed database import.
- TheSportsDB check: all-leagues returned only 10 rows; 21 Nov events-day returned 3 events (two Brazil, one Sweden), adding no missing UEFA country.
- OpenFootball Europe index: 207 files, mostly 2024–25 or 2025 calendar seasons. Only France, Netherlands and Portugal show 2026–27 entries. CC0/public domain, useful for historical research but not a current feed for the remaining gap.
- FotMob and SofaScore were not adopted despite technically reachable endpoints. FotMob's terms prohibit automated retrieval without permission; SofaScore terms prohibit database extraction/re-use without express consent. References: https://github.com/probberechts/soccerdata/issues/918 and https://www.sofascore.com/terms-and-conditions (2.8–2.9). Do not repeat scraping probes or integrate without written permission.

### Implementation in MAIN
- Commit 2d1ae325a7d8ad4bbaf4d2697434c5e6a2b62acb adds the Football Charts fallback to authenticated footynomad-sync, provider aliases and regression tests. It calls only eight allowlisted league endpoints, filters to the exact Europe/Brussels date, parses documented UTC timestamps, stores minimal fixture fields and source URL/attribution, and discards the provider model and stats.
- Commit f382cab9cb8228ef64ad154a602966e9037edf42 adds an owner-only gate for personal-use licensing. The feed is fetched only for owner UUID 668d578c-40dd-4767-8b9d-6b17c7eeebb5; other signed-in accounts skip it. It is not exposed through public moneyball-public-sources.
- Cache: 12 hours after full success, 30 minutes after partial failure. Eight requests per scan; two scans could use up to 16 of 25 keyless daily requests if isolate cache is cold. Repeated manual scans can exhaust the limit; failures do not block FootyNomad.
- Migration 20261117102000_add_footballcharts_bulgaria_lithuania_aliases.sql applied. SQL now accepts Bulgaria efbet League and Lithuania TOPLYGA.
- SQL regression 15/15 passed. Frontend tests, Edge Function type-check and build passed.
- GitHub CI 44053372684 SUCCESS; Cloudflare MAIN deploy 44053372690 SUCCESS for f382cab9. Supabase footynomad-sync v88 deployed with verify_jwt=true; deployed source inspection confirms allowlist, owner gate, attribution and model exclusion.
- Worker root and /login load; /panel returns login_required without a user session. Authenticated post-deploy scan is still pending, so DB import is not yet proven end-to-end.

### Next actions
1. Verify footynomad-sync v88 on the next authenticated MAIN scan (15:00 Europe/Brussels): provider status, requests, eligible fixture count, inserts, deduplication and predictions. Do not fabricate a user session or request credentials.
2. Monitor the 25/IP daily keyless request budget; keep to eight allowlisted leagues. No key is stored or required.
3. Find lawful current feeds for the 18 remaining associations. Do not treat old OpenFootball files as current fixtures or scrape FotMob/SofaScore.
4. Fresh Belgian bookmaker odds remain unavailable; MAIN/MEGA/EXTRA stay blocked when verified odds are absent.
5. Issue #77 stays OPEN; project is not complete.
## FootyNomad day-page vs DB reconciliation — 2026-11-17 10:24 Europe/Brussels

- Full FootyNomad page for 17 Nov reports 173 matches across 20 countries: https://footynomad.com/fixtures/2026-11-17
- Owner DB contains 99 FootyNomad rows for the Brussels-local day. Grouped DB counts: 41 European domestic-category rows, 57 UEFA/World competition rows (senior Nations League and U17/U19/U21/U20 competitions), plus one Ukraine Persha Liga row involving Polissya II.
- The page's European domestic categories are exactly France National 2 (1), Czech 3. liga (1), England domestic lower tiers/cups (28), Northern Ireland Championship (2), Portugal U23 (1), Scotland Lowland League (8) = 41; all 41 are present in the DB. No European domestic day-page fixture omission was found in this comparison.
- Exactly 2/41 European domestic rows qualify: Northern Ireland Championship matches Rathfriland–Moyola Park and Warrenpoint–Glenavon. The remaining 39 are correctly out of scope: France National 2 (tier 4), Czech 3. liga (tier 3), England EFL Trophy/cups and National League North/South + Non-League Premier (lower tiers), Portugal Liga Revelação U23, Scotland Lowland League (below tier 2).
- Ukraine Persha Liga is not a reserve-tier alias issue: one side is Polissya II, so the B-team exclusion correctly rejects it.
- The 173 page total is global, not Europe-only: it includes AFC U17, AFCON qualifiers, friendlies and non-European domestic fixtures. Do not compare 173 directly with the 99 Europe-filtered stored rows or treat the difference as an importer failure.
- This reconciliation confirms the day-specific European filter and importer coverage for the visible European domestic categories. It does not prove every country has a source on every date; the separate 18-country source gap remains.
## OpenLigaDB / FixtureDownload checks and remaining provider deploy — 2026-11-17 10:27 Europe/Brussels

- OpenLigaDB directory returned 849 historical/current-season rows. Filtering 2025+ showed the current 2026 season is concentrated in Germany plus selected already-covered countries (Austria, England, Netherlands, Spain) and international tournaments. It adds no new association among the remaining 18. The Spanish LaLiga 2026 endpoint returned 380 records with valid matchDateTime; Eredivisie returned 306 but matchDateTime was null and matchDateTimeUTC was the invalid 1970-01-01 sentinel; Austria shortcuts tested returned zero. Do not import the broken ERE time values.
- FixtureDownload's current football catalogue exposes UEFA tournaments and some major domestic leagues, but no verified domestic tier-1/tier-2 feed for the remaining 18 associations. No new integration added.
- Important deployment follow-through: moneyball-free-feed was updated in code with efbet League and TOPLYGA aliases but was still deployed at v43. It is now deployed as v44, verify_jwt=true, preserving JWT protection. footynomad-sync remains v88, verify_jwt=true. This closes the code-vs-edge version mismatch for the new aliases.
- No authenticated user scan was run from this audit; the next 15:00 MAIN scan remains the end-to-end check.