# MONEYBALL — Trust the Process

Independent, Polish-language football analytics PWA. This is a clean rebuild, separate from the existing production application.

## Zero-cost design
- Static application hosted on Cloudflare Workers Free within the published free quotas.
- No paid API keys, subscriptions, Supabase project, paid database, Google Sheets, Vercel or Lovable.
- The Tracker stores data locally in the user's browser. JSON backup/restore is built in. Browser-local records do not sync automatically between devices.
- Public football sources are fetched directly from the browser where CORS and source terms allow it.
- If free quotas or a provider's terms change, the app reports the limitation instead of silently switching to a paid service.

## Current implementation
- Mobile-first React + TypeScript + Vite shell.
- Dashboard, European fixtures, Typ dnia, coupons, Intelligence and Tracker modules.
- Daily European fixture scan from the public open-matchday CSV index, filtered by Europe/Brussels date and domestic league folders.
- Local Tracker with append/import/export behavior; import merges missing IDs and never overwrites existing rows.
- Prediction-domain checks for 1X2 normalization, derived Double Chance, fixture deduplication and exactly-three-distinct-match coupon calculation.

## Important data limitations
The open-matchday source is a non-commercial public dataset updated daily. It includes fixtures and selected historical match statistics for many competitions, but coverage is uneven and it does not provide a complete xG, confirmed lineups, injuries, bookmaker odds or guaranteed live results feed. The app must show source provenance and never invent missing values. See [source repository and terms](https://github.com/oladeeayo/open-matchday).

## Build and test
```bash
bun install
bun run typecheck
bun run test
bun run build
```

See `docs/PRODUCT_SPEC.md`, `docs/DOMAIN_MODEL.md` and `docs/REBUILD_EXECUTION_LOG.md`.


This project is designed to stay within free service quotas; no paid services are required or configured.
