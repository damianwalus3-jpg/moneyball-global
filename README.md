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
- Daily Europe/Brussels fixture scan combines open-matchday, OpenLigaDB, OpenFootball, ESPN, FootyNomad, timezone.football and the public Flashscore daily feed. All source results are merged and deduplicated; per-source coverage and errors are retained.
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

## European fixture sources

The daily scan combines seven public fixture sources: **open-matchday**, **OpenLigaDB**, **OpenFootball**, **ESPN Soccer**, **FootyNomad**, **timezone.football** and the **Flashscore public daily feed**. The first six are read through their public feeds/pages; Flashscore is proxied by the same Cloudflare Worker and filtered server-side. No paid scraper or proxy is used.

- **open-matchday** — daily CSV catalogue, including all currently indexed European folders with fixtures; non-commercial terms apply and coverage varies by competition.
- **OpenLigaDB** — public season catalogue and match feeds; requests are throttled and Worker responses cached.
- **OpenFootball** — public-domain Football.TXT repositories for selected European leagues and cups; repository coverage and update cadence vary.
- **ESPN Soccer** — public daily scoreboards; fixtures are accepted only when the event metadata identifies a European country or UEFA event.
- **FootyNomad** — public fixture date pages; previous/current UTC pages are normalized to Europe/Brussels date and filtered to UEFA countries/competitions.
- **timezone.football** — attributed public 14-day feed, cached for 15 minutes as required by its feed guidance.
- **Flashscore** — public daily feed proxied by the Worker; explicit non-European confederations are excluded and only today's Europe/Brussels fixtures are accepted.

All feeds are normalized to Europe/Brussels date, merged and deduplicated by date/team identity (with women's fixtures distinguished). Per-source counts and errors are retained. Provider counts must not be summed as unique matches. No single free feed or combination currently proves complete coverage of every European senior, women's, youth, regional and amateur match; missing data is never invented. OpenLigaDB data is subject to its ODbL 1.0 and fair-use guidance; open-matchday's non-commercial terms must be respected.

### Additional fixture source: OpenFootball

The rebuild also reads public-domain Football.TXT feeds from OpenFootball for selected 2026/27 European competitions: France, Greece, Netherlands, Portugal, Scotland, Switzerland, Turkey, Czech Republic, Austria, England (top two tiers), Germany (top three tiers and DFB-Pokal), Spain, Italy and Belgium. Kickoff times are converted from the source league's IANA timezone to Europe/Brussels. These are additional feeds, not a complete European competition register; each repository has its own update cadence and missing files are reported.

### Coverage audit (2026-11-17)

The live open-matchday build summary listed 75 competitions, 65 of which were European folders accepted by the current country/UEFA allowlist. This included domestic cups, selected lower tiers and Belgian U21. It is a dated source snapshot, not a complete census of Europe. The app shows current provider counts and failures; it never claims that every European match is guaranteed to be present.

Automated FotMob/Sofascore scraping is intentionally not used: their terms/official support material restrict programmatic reuse or do not offer public API access. The current source set stays within public open-matchday, OpenLigaDB and public-domain OpenFootball feeds.


## Release acceptance — 2026-11-18

- Active release branch: `moneyball-rebuild`; production Worker: `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.
- Release commit at acceptance: `8bcab8f52a41c07011a8d1b667c883cb29341586`.
- GitHub CI, rebuild checks, TypeScript, unit tests, production build and Cloudflare deploy all completed successfully on that exact commit (runs `44274730608`, `44274730606`, `44274730636`).
- Live source checks on 2026-11-18: Flashscore endpoint returned 113 European/UEFA fixtures from 89 competition headers and excluded 102 non-European rows from 215 raw rows; FootyNomad returned 102 fixtures across two pages without endpoint errors. These are separate provider counts, not a combined unique-fixture total.
- UI loads the daily scan automatically and refreshes every 15 minutes; manual refresh is available. Scan records and fixture rows are appended idempotently to the local Tracker.
- The Tracker is browser-local (localStorage), not cloud-synced. Export JSON backups regularly and import them on another browser/device when needed.
- The prediction model is a recent-goals Poisson calculation using available historical results. It is **not xG-trained**, does not confirm lineups/injuries, and must not be presented as a guaranteed forecast.
- Odds provider secrets are present in Worker configuration, but the owner-only odds pilot is disabled. No live odds, EV or automatic bookmaker pricing is available in this release; no provider credits are consumed by the ordinary fixture scan.
- The coupon engine enforces exactly three distinct fixtures and a 75% model-probability gate. Coupon calculations are paper/analytical records, not bookmaker bet placement.
- Browser-level interactive acceptance on a physical Android device has not been completed. CI and live endpoint checks prove deployment and API behavior, not every visual interaction.
- **Release decision:** deployed and operational for the documented local-first fixture, prediction, paper-coupon and Tracker scope, with the above data/product boundaries. Do not open more feature stages by default. Only reopen work for a reproducible defect, a production source outage, a security issue, or a user-requested change. Never claim exhaustive European fixture coverage.


## Rebuilt market and model controls (2026-11-18)

- Every scanned European fixture receives independent Tracker prediction rows for `1X2` and `DOUBLE_CHANCE`. Fixtures that have already kicked off are explicitly recorded as rejected pre-match analyses rather than silently omitted.
- The goals-only Poisson model and the PitchAPI xG/xGA Poisson model are evaluated independently whenever their own historical samples are available. The UI shows model/market comparisons using Brier score, log loss, accuracy, calibration buckets and expected calibration error (ECE).
- Calibration qualification requires at least 30 settled distinct fixtures per model and market. Below that threshold, metrics are shown as provisional and must not be treated as validated.
- Team-history eligibility for a coupon requires at least 3 previous matches for each team and a verified kickoff. Neutral-prior placeholders are never coupon-eligible.
- Coupon candidates require a selected market probability of at least 75%. Each generated coupon contains exactly 3 distinct fixtures; a fixture qualifying in both markets can appear only once. Double Chance legs are settled as 1X/X2/12 and are not assigned bookmaker odds unless a complete DC odds feed exists.
- Tracker records remain append-only in the UI; destructive per-row deletion is disabled. Backup import merges missing record IDs and never overwrites existing rows.
- PitchAPI is a free API source (key required) and is accessed server-side through the Cloudflare Worker secret `PITCHAPI_API_KEY`; no API key is exposed in browser code. See [PitchAPI reference](https://pitchapi.dev/).
