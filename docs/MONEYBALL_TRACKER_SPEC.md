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

Today, the schema stores a legacy `group_name` on predictions and `coupon_type` on coupons. The additive registry is now implemented in `moneyball_tracker_categories`, with system categories, owner-scoped custom categories, and immutable legacy mappings in `moneyball_tracker_category_aliases`. Original group names and coupon types remain unchanged; missing or unknown values resolve to `UNCLASSIFIED`.

## Jackpot numbering

Jackpot now has its own stable ID and owner-scoped sequence such as #001 in `moneyball_jackpot_entries`. New sequence values are allocated once under a transaction lock and never recalculated from current sort order or renumbered when a coupon is hidden. The linked coupon is protected by an owner-scoped foreign key. PASS and PAPER may display hypothetical AKO when every leg has a valid stored price, but must remain excluded from official finance.

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


## Implementation status — 2026-11-17

The first production Tracker release is implemented on the existing MAIN application and database.

### Delivered

- Authenticated route `/tracker` is registered in TanStack Router and exposed in desktop/mobile navigation.
- Overview reads the existing dashboard summary, selected picks, coupon finance summary and latest scan. It does not download the full predictions history.
- Server-side RPC `moneyball_tracker_category_summary` returns category, decision, source and settlement aggregates only; it maps legacy and missing labels without downloading the full prediction history.
- Category registry is persisted in `moneyball_tracker_categories`: 15 global read-only system categories (including `UNCLASSIFIED`) plus owner-scoped custom-category support.
- Legacy category mapping is persisted in `moneyball_tracker_category_aliases` (14 aliases, including missing `group_name` values). Historical `MAIN` remains a separate legacy category and is never silently rewritten as `MAIN A` or `MAIN B`.
- Jackpot register is persisted in `moneyball_jackpot_entries`, linked to an existing coupon with an owner-scoped foreign key. Sequence numbers are owner-scoped, allocated under a transaction advisory lock, immutable after insert and not deletable through the authenticated API.
- Jackpot sequence allocation also preserves explicit sequence numbers during JSON backup restore; the next new entry continues at max(sequence)+1.
- Owner-created categories can be archived and restored without deletion; system categories remain immutable. Archive state is included in backup/restore and the aggregate RPC.
- Added nullable `predictions.decision_status`, `predictions.source_class` and `coupons.source_class`. Existing rows remain NULL/unclassified; no bulk historical relabeling occurred.
- The model prediction Edge Function writes `source_class=MODEL` and decision states `FINAL/REJECTED` for new/upserted model rows. Active production function: `moneyball-predict` version 249.
- New generated TEST coupons are `PAPER`; MAIN/MEGA/EXTRA are `MODEL`. PAPER coupons are excluded from the official coupon-finance summary and do not create bankroll stake/return transactions during settlement or cancellation.
- Existing legacy TEST coupons with NULL source class remain unclassified and unchanged; they are not silently treated as PAPER.
- Backup/restore table order now includes owner categories and Jackpot entries. Global system categories and aliases are recreated by migrations.

### Production migrations

- `20261117121443_moneyball_tracker_registry_and_jackpot`
- `20261117121659_preserve_jackpot_sequence_on_restore`
- `20261117121922_exclude_paper_coupons_from_official_finance`
- `20261117122156_add_unclassified_tracker_category`
- `20261117122648_moneyball_tracker_category_summary`
- `20261117123139_add_tracker_category_archiving`
- `20261117123206_tracker_category_summary_archive_state`

All seven are additive. They do not rewrite historical matches, predictions, coupons, coupon legs, results or bankroll transactions.

### Verification snapshot

- 15 system categories; 14 legacy aliases.
- 0 Jackpot entries at deployment time — no synthetic entries were created.
- 19,201 predictions; 9 coupons; 9 bankroll transactions remained unchanged by the migrations.
- New tables have RLS enabled with owner/system-specific policies. No new Supabase health lints or security-advisor findings were introduced by the Tracker tables.
- The aggregate RPC was checked against the authenticated owner scope and its totals matched the 19,201 prediction and 9 coupon records.
- CI passed: 86 tests, Supabase Edge Function type-check, application type-check and production build.
- Cloudflare MAIN deployment workflow completed successfully for the current Tracker release.
- The `/tracker` route remains behind the existing authentication guard; unauthenticated route fetches return `login_required`.

### Remaining work

- Validate the rendered page and create the first real Jackpot entry through an authenticated user session.
- Add category edit/archive controls and explicit legacy source classification.
- Add separate PAPER reporting and verify finance/settlement behavior with controlled non-production fixtures; do not fabricate production rows.
- Continue full authenticated UI, backup/restore and settlement regression testing before declaring the whole Tracker complete.

The Tracker is therefore deployed as a working first release, not declared fully complete.
