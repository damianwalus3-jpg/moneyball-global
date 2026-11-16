# MONEYBALL GLOBAL 2.0

Polish-language football data and prediction tracking application. The existing Supabase project remains the source of truth for authentication and data; the application frontend is hosted on the existing Cloudflare Worker.

## Stack

- React 19, TanStack Start and Vite
- Nitro production output for Cloudflare Workers
- Supabase Auth and Postgres with owner-scoped RLS
- Bun for dependency management and tests

## Main workflows

- European domestic fixtures, primarily the first and second tiers, from FootyNomad and public no-key sources
- Prediction engine MONEYBALL GLOBAL 3.8 with explicit data coverage and missing-data reporting
- 1X2 probabilities, Double Chance derived from 1X2, and a separate Poisson goals model
- Three-leg coupon generation using only active-model or manual candidates above 75%
- Result settlement and coupon settlement
- Fixed €4 virtual analytical stake for every selected single pick and generated coupon; the app does not place real-money bets
- Tracking of bookmaker odds, gross potential return and settled net profit/loss when the required data is available
- CSV/JSON import, export and backup

The application must not fabricate missing xG, odds, lineups, injuries or match results. Missing data remains explicitly marked as unavailable.

## Model inputs and limits

The prediction engine can use verified match history, FootyNomad form, OpenMatchday/OpenFootball public results, ESPN public results and roster/injury endpoints for supported competitions, BeyondELO ratings, historical xG datasets (OpenPlay, StatsBomb Open Data, American Soccer Analysis), and market-derived fair probabilities from TipsAudit. These sources have different league coverage and update cadence; none is a complete global live xG or lineup feed.

- OpenPlay is a historical men's dataset with selected competitions; the current public snapshot is generated 2026-11-12 and its latest match date is 2026-08-12.
- StatsBomb Open Data contains selected historical competitions, not a current live feed.
- American Soccer Analysis covers selected North American leagues, not the European domestic schedule.
- OpenMatchday/OpenFootball primarily supply match results and form, not xG.
- FootyNomad supplies fixtures and form; ESPN roster data is not a confirmed matchday lineup.
- BeyondELO supplies team ratings, not xG.
- TipsAudit fair probabilities are market-derived inputs, not an independent xG model.
- MoviOdds currently supplies bet365 quotes; odds are distinct from model inputs.

Historical xG is used only when both teams have at least three eligible xG matches from the preceding 240 days. Missing xG, lineups, injuries and odds must remain explicitly unavailable. Probability temperature scaling is disabled until a reproducible, versioned out-of-sample calibration report is available. The displayed 0–100 coverage value is a data-coverage heuristic, not statistical confidence.

Double Chance is currently calculated from the 1X2 probabilities, not trained as an independent model. Goals markets use a separate Poisson model.

## Supabase

Existing project: `gzgeklcukrclgwbsmbsp`

The browser app uses only the public/publishable key. Never place a Supabase service-role or secret key in browser code, Vite variables, or committed files. Owner isolation is enforced by RLS.

## Local development

```sh
bun install
bun run dev
bun run test
bunx tsc --noEmit
bun run build
```

The `.github/workflows/ci.yml` workflow runs tests, Edge Function type checks, TypeScript and production build on pushes and pull requests to `main`. A successful CI run must be confirmed in GitHub Actions before release.

## Production deployment

The production target is the existing Cloudflare Worker `moneyball-global`, configured in `vite.config.ts` with Nitro's `cloudflare_module` preset. Keep the existing Worker and the existing Supabase project; do not create another app or move deployment to Vercel. A GitHub commit alone does not prove that Cloudflare has deployed it: verify the Worker deployment and the public URL separately.
