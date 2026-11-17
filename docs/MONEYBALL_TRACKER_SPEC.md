# MONEYBALL TRACKER — canonical data architecture

Status: design baseline, 2026-11-17  
Repository: `damianwalus3-jpg/moneyball-global`, branch `main`  
Production: existing Cloudflare Worker + existing Supabase project

## Decision

Do not create a second application, a second database, or a Google Sheet as a competing source of truth. The current MONEYBALL application already has a live owner-scoped Supabase/Postgres data model and working records for fixtures, predictions, coupons, coupon legs, verified results, odds snapshots, scan runs, and bankroll transactions.

The canonical MONEYBALL Tracker is therefore the existing application database plus a dedicated tracker experience in the app. Google Sheets may later be connected as an optional import/export/reporting mirror. It must never overwrite the canonical database automatically.

No existing production records are to be deleted, rewritten, re-numbered, or silently reclassified. All schema additions must be additive, reviewed, tested, and separately deployed.

## Existing canonical records

The current application schema in `src/lib/schema.ts` and `src/lib/types.ts` defines these tables:

| Table | Canonical purpose |
|---|---|
| `scan_runs` | Scan execution, source, date, status and match counts |
| `matches` | One canonical fixture/event, source identifiers, competition, teams, kickoff and event status |
| `predictions` | Model/manual market selections, probability, verdict, odds, stake and settlement |
| `coupons` | Coupon header, type, status, combined odds, stake and potential return |
| `coupon_legs` | Ordered coupon legs linked to prediction and match |
| `match_results` | Verified final score and 1X2 outcome |
| `odds_snapshots` | Historical bookmaker quote snapshots |
| `bankroll_transactions` | Auditable virtual bankroll movements |

Existing owner isolation/RLS, settlement routines, coupon finance RPCs, backup/restore, and CSV/JSON import/export must be retained.

## Canonical identity and deduplication

- Match identity is the canonical `matches.id`; external source IDs are aliases, not the primary app identity.
- Prediction identity is `predictions.id`. A market selection must remain a distinct prediction even when another market exists for the same match.
- Coupon identity is `coupons.id`; coupon legs are identified by `coupon_legs.id` and ordered by `leg_number`.
- A coupon must not contain two legs for the same match. Preserve the existing unique coupon/match guard.
- Results UI groups all predictions for one canonical match into one match card. It must not create duplicate event cards because the same event is referenced by a single pick, coupon leg, or Jackpot view.
- Never deduplicate by team names alone. Use source IDs and guarded normalized team/date matching; ambiguous matches remain unresolved.

## Decision status vs sporting settlement

These are separate dimensions and must stay separate.

Decision lifecycle to support in the Tracker UI:
- `FINAL`: officially selected
- `WATCH`: observation only
- `LEAN`: provisional preference
- `CONDITIONAL`: eligible only after stated condition is verified
- `REJECTED`: evaluated and rejected
- `PASS`: no official selection/coupon
- `PAPER`: simulated/test selection

Sporting settlement lifecycle to support:
- `PENDING`, `WIN`, `LOSS`, `VOID`, `PUSH`, `HALF_WIN`, `HALF_LOSS`

The current database has legacy verdict values `WYBRANY` / `ODRZUCONY` and settlement values `pending` / `won` / `lost` / `void`. Do not reinterpret old values in place. Introduce explicit normalized view-model mapping first, then an additive migration only after checking all database constraints, RPCs, triggers, edge functions and historical consumers. Asian/quarter-line partial outcomes require a documented settlement calculation before being enabled.

## Source and finance separation

Every record shown in financial analytics must be attributable to a source:
- `USER`: actual user-entered real-world stake/result, only when explicitly recorded by the user.
- `MODEL`: virtual analytical tracking; never presented as a real-money bet.
- `PAPER`: simulation/test, excluded from official financial totals.

The existing fixed €4 analytical stake rule remains in force for new selected analytical picks/coupons unless the user changes it. Historical stake values remain immutable. Do not create fake production fixtures, picks, coupons, odds, or financial transactions to test the tracker.

Official finance excludes WATCH, LEAN, CONDITIONAL, REJECTED, PASS and PAPER unless a future explicitly approved reporting view says otherwise. Coupon-level finance and single-pick finance must not double-count the same stake. The bankroll ledger remains the auditable source for balance changes.

## Configurable categories

The intended configurable sections are:
`TYP DNIA`, `MAIN A`, `MAIN B`, `EXTRA`, `MEGA`, `LOW LEAGUE`, `MULTI-SPORT`, `NHL/NBA`, `JACKPOT`.

Today, the schema stores a legacy `group_name` on predictions and `coupon_type` on coupons. A future additive category registry should provide a stable category ID, display name, order, enabled flag, sport scope, official-finance flag, and display color. Existing group names and coupon types must be mapped without losing their original values.

## Jackpot numbering

Jackpot needs its own stable ID and a display sequence such as #001. Sequence values must be allocated once and never recalculated from current sort order or renumbered when a coupon is deleted/hidden. PASS and PAPER may display hypothetical AKO when every leg has a valid stored price, but must remain excluded from official finance.

## Tracker screens

The Tracker UI should provide:
1. Overview: current-day selected picks, open coupons, bankroll summary and latest verified results.
2. Selections: filter by date, category, sport, league, decision status, settlement, source and market.
3. Coupons: coupon headers and their ordered legs, AKO, stake, return, P/L and settlement progress.
4. Jackpot: immutable sequence, legs, hypothetical AKO and dedicated performance.
5. Results: one card per canonical match with all associated picks/categories/markets.
6. History: complete paginated history; filters must never delete or hide records from backup.
7. Intelligence: separate event-level and coupon-level metrics, source-separated USER/MODEL/PAPER, sample sizes, ROI and calibration diagnostics.
8. Data & Backup: schema health, import/export, backup/restore and future optional Google Sheets sync.

## Safe synchronization and backup

- Supabase remains the single source of truth.
- Google Sheets connector, if added, is opt-in and initially read-only/export-only.
- Every import requires preview, row counts, validation, duplicate report and explicit confirmation.
- Imports must be idempotent and must not overwrite existing IDs or formula cells.
- Keep periodic JSON backups and CSV exports. Restore skips existing IDs by default.
- Record sync/import timestamps, source and errors. Never claim synchronization succeeded until verified.

## Delivery sequence

1. Finish read-only audit of the current database schema, constraints, RLS, RPCs, triggers, Edge Functions and UI consumers.
2. Add a normalized Tracker domain layer and tests without changing production data.
3. Add only additive database migrations for genuinely missing entities (category registry, Jackpot identity/sequence, source classification, push subscriptions and notification outbox) after dependency review.
4. Build the Tracker interface using the existing authentication, database and app navigation.
5. Add import/export mapping and optional Google Sheets mirror only after the in-app Tracker is stable.
6. Run unit, type, build, migration, RLS, deduplication, settlement, backup/restore and authenticated UI tests.
7. Deploy only to the existing Cloudflare MAIN and existing Supabase project through the authorized deployment path. Verify both independently.

## Non-goals and safety

- No Vercel migration.
- No second app or second database.
- No paid sports-data/API subscription without explicit approval.
- No fabricated odds, results, lineups, injuries or historical rows.
- No automatic real-money bet placement.
- No destructive migration or bulk historical rewrite.
