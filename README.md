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

## Current audit

- Active model: `MONEYBALL GLOBAL 3.8`.
- Canonical Supabase fields are mapped to legacy read-only view aliases in `src/lib/db.ts`.
- Compatibility triggers prefer the field changed by the current write, so stale legacy aliases cannot overwrite canonical updates.
- Active Edge Function source is tracked under `supabase/functions/`; database changes are tracked under `supabase/migrations/`.
- Fixture scan and prediction are separate authenticated Edge Function calls; result sync is chained by the fixture sync.
- The `main` branch CI checks tests, TypeScript and production build.

## Validation

```sh
bun run test
bunx tsc --noEmit
bun run build
```

The `.github/workflows/ci.yml` workflow is configured to run the tests, TypeScript check and production build on pushes and pull requests to `main`. A successful CI run must be confirmed in GitHub Actions before release.

## Production build and deployment

The Vite config uses TanStack Start and Nitro with automatic host detection. The intended production host is Vercel.

The repository includes `.github/workflows/deploy-vercel.yml`. After adding these repository Actions secrets, every push to `main` can build and deploy the application:

- `VERCEL_TOKEN` — Vercel deployment token.
- `VERCEL_ORG_ID` — Vercel team or account ID.
- `VERCEL_PROJECT_ID` — the Vercel project ID for this repository.

Without all three secrets, deployment is deliberately skipped. No production URL is claimed until a deployment is completed and verified. The existing `finalne-typy.vercel.app` address is not referenced by this repository and currently displays the older Tracker loading screen, so it must not be assumed to be this app's verified deployment.


The Vite config uses the standard TanStack Start and Nitro plugins. Production builds target the Cloudflare Workers module runtime.

The repository includes `.github/workflows/deploy-cloudflare.yml`. After adding these two repository Actions secrets, every successful push to `main` builds and deploys the Worker:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with permission to edit Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID` — target Cloudflare account ID.

You can also run the workflow manually from GitHub Actions. Without both secrets, deployment is deliberately skipped; the build and tests still run. No live URL is claimed until a deployment is completed and verified.
