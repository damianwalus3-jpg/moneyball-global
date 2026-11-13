# MONEYBALL GLOBAL 2.0 — Cloudflare Test

Polish-language football data and prediction tracking application. This branch is an isolated test environment and does not deploy to Vercel or write to the production Supabase project.

## Test environment

- Cloudflare Worker: https://moneyball-global-test.damianwalus3.workers.dev
- Supabase test project: `xwrgfaarmwnguymresjy` (EU West)
- Git branch: `migration/cloudflare-workers-setup`
- Production Supabase project and the `main` branch are not modified by this test deployment.

## Stack

- React 19, TanStack Start and Vite
- Cloudflare Workers via `@cloudflare/vite-plugin` and Wrangler
- Supabase Auth and Postgres with owner-scoped RLS
- Bun for dependency management and tests

## Features under test

- European fixtures from FootyNomad, enriched with public no-key sources
- MONEYBALL GLOBAL 3.8 prediction engine with explicit data coverage and missing-data reporting
- Separate 1X2 and Double Chance predictions, plus goals / BTTS markets
- Single picks and three-leg coupon generation
- Match details with model rationale and source coverage
- Result settlement and coupon settlement
- Fixed €5 analytical stake; no cash bets are placed by the app
- Odds tracking when a fresh, verified quote is available

Missing xG, odds, lineups, injuries or match results must remain explicitly unavailable. The model must not fabricate inputs or probabilities.

## Local development

```sh
bun install
bun run dev
bun run test
bunx tsc --noEmit
bun run build
```

## Deploy

GitHub Actions deploys only this branch to the isolated Cloudflare Worker. The workflow runs tests, TypeScript validation and the Cloudflare build before deployment. Required GitHub environment values are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The application uses the test Supabase project by default. Only its public publishable key is embedded in browser configuration. Never put a service-role or secret key in browser code or committed files. Supabase Edge Functions use their own runtime-provided service-role environment variable.

## Important

This branch is a test environment. Do not merge it into `main` or change the production Vercel deployment until the full scan, prediction, odds, coupons, authentication and settlement flows have passed end-to-end testing.
