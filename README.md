# MONEYBALL GLOBAL 2.0

Polish-language football data and prediction tracking application. The app uses the existing Supabase project as its source of truth and keeps 1X2 and Double Chance predictions separate.

## Stack

- React 19, TanStack Start and Vite
- Nitro production output for Cloudflare Workers
- Supabase Auth and Postgres with owner-scoped RLS
- Bun for dependency management and tests

## Main workflows

- European fixtures from FootyNomad, enriched with public no-key sources
- Prediction engine MONEYBALL GLOBAL 3.8 with explicit data coverage and missing-data reporting
- Separate 1X2 and Double Chance predictions
- Three-leg coupon generation using only active-model or manual candidates above 75%
- Result settlement, coupon settlement and bankroll ledger
- CSV/JSON import, export and backup

The application must not fabricate missing xG, odds, lineups, injuries or match results. Missing data remains explicitly marked as unavailable.

## Supabase

Existing project: `gzgeklcukrclgwbsmbsp`

The browser app uses only the public/publishable key. Never place a Supabase service-role or secret key in browser code, Vite variables, or committed files. Owner isolation is enforced by RLS.

## Local development

```sh
bun install
bun run dev
```

## Validation

```sh
bun run test
bunx tsc --noEmit
bun run build
```

GitHub Actions runs the same tests, type-check and production build on pushes and pull requests to `main`.

## Production build and deployment

The Vite config uses the standard TanStack Start and Nitro plugins. Production builds target the Cloudflare Workers module runtime.

```sh
bun run build
bunx wrangler login
bunx wrangler deploy
```

Deployment requires access to the intended Cloudflare account. No live URL is claimed until a deployment is completed and verified.
