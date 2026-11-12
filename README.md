# MONEYBALL GLOBAL 2.0

Polish-language football intelligence and betting-history app with separate 1X2 and Double Chance markets, match history, coupons, settlements, audit and bankroll tracking. User-facing dates use Europe/Brussels.

## Stack

- React + TanStack Start + Vite + Nitro
- Supabase JS with the owner's existing Supabase project
- Tailwind CSS
- Bun lockfile (`bun.lock`)

## Primary data and prediction pipeline

The primary scan is the deployed Supabase Edge Function `footynomad-sync`, followed by `moneyball-predict` (Moneyball Global 3.8). The deployed public-source pipeline uses keyless public datasets including FootyNomad, OpenMatchday, OpenFootball, OpenPlay historical xG, StatsBomb Open Data xG, American Soccer Analysis (selected North American leagues), BeyondELO ratings and verified match results. Fresh market probabilities are used only when available and recent. Missing xG, team form, lineups or injuries are not fabricated.

The app also contains a supplemental ESPN public scoreboard scan for a fixed catalogue of competitions. Its goals-only Poisson predictions are a fallback, not a replacement for the primary xG/Elo engine. ESPN coverage is not complete worldwide.

Some optional integrations such as PitchAPI are not used by the primary no-provider-key pipeline. Do not add paid provider keys to browser code.

## Database and security

- Preserve the owner's existing Supabase project, schema, RLS policies and history. Never reset or drop tables.
- The browser uses only the Supabase publishable/anon key and the signed-in user's session. Never put a `service_role` key in client code.
- App inserts must populate the canonical database fields (`market`, `selection`, `verdict`, `settlement_status`, coupon `leg_number`, bankroll `transaction_type`) as well as the compatibility fields used by the UI.
- Schema diagnostics are read-only; no database migrations are applied automatically.

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

The Vite build uses Nitro's `cloudflare_module` preset and no longer depends on Lovable's build wrapper or telemetry. A live deployment still requires a Cloudflare account and deployment credentials configured outside the repository; no secret is committed to source control.
