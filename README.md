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

The repository includes `.github/workflows/deploy-cloudflare.yml`. After adding these two repository Actions secrets, every successful push to `main` builds and deploys the Worker:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with permission to edit Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID` — target Cloudflare account ID.

You can also run the workflow manually from GitHub Actions. Without both secrets, deployment is deliberately skipped; the build and tests still run. No live URL is claimed until a deployment is completed and verified.
