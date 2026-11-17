# FootballCharts durable cache call-site fix — 2026-11-17

## Production continuation

- Repository: `damianwalus3-jpg/moneyball-global`, branch `main`.
- Fixed the stale call site in `supabase/functions/footynomad-sync/index.ts`: the durable cache reader now receives all required authenticated context: `readFootballChartsFixtures(date, ownerId, token)`.
- The preceding CI failure was a real TypeScript error: TS2554 at the old one-argument call (expected 3 arguments). Edge-function type checking had stopped the remaining CI steps and prevented the Cloudflare deployment.
- Fix commit: `8e552e7bd139908bd52b791fdf0c25693b634dd4`.
- GitHub Actions Moneyball CI run `44147043892`: SUCCESS. Geographic Europe tests, all-tier domestic league tests, bearer-token tests, Supabase Edge Function type-check, Vitest, TypeScript check and production build all passed.
- Cloudflare MAIN deployment run `44147043966`: SUCCESS, including Cloudflare production build and deployment step.
- Supabase production project `gzgeklcukrclgwbsmbsp` is ACTIVE_HEALTHY. Applied migration `20261117163632` is present.
- Deployed `footynomad-sync` Edge Function version `104`, ACTIVE, `verify_jwt=true`. Retrieved deployed source and verified it contains the corrected three-argument call.
- Verified `public.moneyball_provider_cache` exists with RLS enabled and exactly three owner-scoped policies.
- No match rows, predictions, coupons, settlements, bankroll values or historical data were changed by this fix.

## Remaining acceptance work

- Still required: authenticated owner POST scan through the existing MAIN session, followed by readback proving the durable cache row is written and then reused across invocations.
- Still required: authenticated visual click-through of Matches and Predictions. Keep issue #77 OPEN until those checks are completed.
- Do not treat successful CI, Cloudflare deployment, or function deployment as proof that authenticated UI acceptance has passed.
