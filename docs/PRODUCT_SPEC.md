# MONEYBALL — Product specification (fresh start)

## Product
MONEYBALL — Trust the Process is a mobile-first installable PWA for football match analysis, transparent prediction tracking, coupon management, live/result monitoring and performance intelligence. Polish is the default language; Europe/Brussels is the default timezone.

## Product principles
- Build as a new application with a clean working tree and clean data model.
- Never fabricate fixtures, results, odds, xG, lineups, injuries, probabilities or source coverage.
- Every imported value carries source, retrieval time and provenance; missing data is shown as unavailable.
- Separate model probability from data coverage and bookmaker implied probability.
- No real-money bet placement. This is an analytical/paper-tracking product.
- Authentication and owner-scoped data access are required before personal data is stored.
- No Google Sheets dependency. The in-app Tracker is the source of truth.
- No paid data provider or API key is assumed. Prefer public sources and disclose coverage/limits.

## Main navigation
1. Dashboard — daily overview, scan status, today's fixtures, strongest model signals, pending settlements.
2. Mecze — searchable/filterable European fixtures, match detail, form, team comparison, model outputs and data provenance.
3. Typ dnia — one transparent daily editorial pick with rationale, risk factors and model version; never forced when evidence is insufficient.
4. Kupony — build and track analytical coupons, legs, odds snapshots, stake, potential return, settlement and history.
5. Intelligence — 1X2, Double Chance, goals, calibration, hit rate, ROI, league/model/source breakdown and audit reports.
6. Tracker — complete searchable registry of scans, matches, predictions, odds, coupons, coupon legs, results, bankroll transactions, categories and Jackpot entries; JSON/CSV import/export and validated backup/restore.

## Prediction and scan requirements
- Scope: European domestic senior football leagues, configurable by country/tier; default scan is today's fixtures in Europe/Brussels.
- Sources: fixture discovery can use FootyNomad and other public sources; independent verification via reputable public results providers. xG sources include OpenPlay, StatsBomb Open Data and other explicitly scoped datasets. Odds are a separate input class.
- Store source URL/provider, fetched_at, source status, competition coverage and normalization decisions.
- Models: 1X2, Double Chance as a separately displayed market derived transparently from 1X2 unless a separately trained model is later validated, and a separate goals/Poisson model.
- Display probabilities, model version, sample size, missing inputs and coverage. Coverage is not confidence.
- Calibration: no calibration adjustment until reproducible out-of-sample validation exists. Store Brier score, log loss, reliability bins and sample count.
- Prediction labels: candidate, watch, rejected; do not silently drop scanned matches. The daily editorial pick may be empty if no defensible selection.
- Coupon builder: exactly three distinct fixtures per standard coupon; enforce no duplicate match legs; candidate pool uses configured probability threshold and transparent exclusions. Never imply a probability is a guarantee.
- Settlement: results are sourced and timestamped; void/postponed/abandoned states are handled explicitly and auditable.

## Tracker and finance
- Tracker is native to the app; no external spreadsheet is required.
- Separate paper/analytical stakes from real bookmaker activity. Defaults must be configurable and clearly labelled.
- Every balance change is a ledger transaction; do not directly overwrite a calculated balance.
- Coupon settlement is idempotent and auditable. Store odds per leg and coupon-level total odds/potential return.
- Web Push is opt-in, permission-gated and limited to user-selected events; no notifications before explicit browser permission.
- Backups are versioned, validated, and restore only by explicit user action; never silently overwrite existing rows.

## UX and security
- Premium dark theme, responsive cards/tables, readable mobile navigation, accessible contrast and keyboard focus.
- PWA manifest, installability, offline shell and safe update handling.
- Authenticated routes, server-side secrets only, owner-scoped RLS, least-privilege RPCs, rate limits and audit logs.
- Never expose service-role credentials in browser bundles or repository.
- Push notifications are opt-in and permission-gated.

## Release gates
- Unit and integration tests for calculations, deduplication, prediction validation, coupon rules, settlement, ledger idempotency and backup restore.
- Type-check, lint, production build, migration validation and security review.
- Verify deployment and real public URL independently from CI.
- Do not call the application complete until the authenticated end-to-end smoke test passes.
