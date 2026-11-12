# MONEYBALL GLOBAL 2.0

Polish-language football prediction tracker with separate 1X2 and Double Chance models, match history, coupons, settlements, statistics and bankroll tracking. User-facing dates use Europe/Brussels.

## Stack

- React + TanStack Start + Vite
- Supabase JS with the owner's existing Supabase project
- Tailwind CSS
- Bun lockfile (`bun.lock`)

## Data and security

- Supabase is the source of truth for business data. Do not replace the existing database.
- The browser accepts only a Supabase publishable/anon key. Never use a `service_role` or secret key in the client.
- Football fixture/results feeds must not require paid provider keys. Current public ESPN scoreboard support is limited to the competitions listed in `src/lib/public-football.ts`; this is not complete worldwide coverage.
- The automatic baseline is goals-based Poisson, not xG. It marks predictions ODRZUCONY when either team has fewer than three prior results in the same competition. It must be calibrated against historical data before being treated as a betting edge.
- No synthetic fixtures, results, odds, lineups or xG values are generated.

## Local development

```sh
bun install --frozen-lockfile
bun run dev
```

## Quality checks

```sh
bun run lint
bun run test
bun run typecheck
bun run build
```

## Deployment

The Vite build uses Nitro's `cloudflare_module` preset. Deploying requires a Cloudflare account and a Wrangler deployment setup; no deployment secret is committed to this repository. Configure deployment credentials in GitHub/Cloudflare settings, never in source files.

## Existing database

The app expects the owner's existing Supabase project and tables: `scan_runs`, `matches`, `predictions`, `coupons`, `coupon_legs`, `match_results`, `odds_snapshots`, and `bankroll_transactions`. Schema diagnostics are read-only. Back up the database before any future schema changes.
