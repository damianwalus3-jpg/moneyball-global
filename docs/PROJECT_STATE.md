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
7. Only then mark the fix complete here. Record every commit, migration, test, deployment version and measured result so later sessions do not repeat work.

## User's operating constraints
- Work directly on the existing app; no rebuild from scratch.
- Preserve all previously implemented functions and historical data.
- Avoid asking the user to repeat project decisions already recorded.
- Do not claim a fix is deployed or permanent based only on a GitHub commit.
- Do not circle back to completed diagnostics; consult this file and the latest source first.
