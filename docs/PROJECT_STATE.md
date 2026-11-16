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
