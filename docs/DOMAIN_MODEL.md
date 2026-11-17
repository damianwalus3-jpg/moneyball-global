# MONEYBALL — initial domain model

This is the clean-slate logical model. Physical migrations will be authored and validated against a newly provisioned backend; no existing production database is reused or truncated.

## Identity and ownership
- `profiles`: one row per authenticated user, locale, timezone, preferences.
- Every private row has `owner_id` and owner-scoped access policy.
- Provider catalog and competition/team reference data may be shared read-only; user tracking records are private.

## Football reference and ingestion
- `providers`, `competitions`, `teams`, `seasons`
- `fixtures`: provider identifiers, normalized home/away teams, kickoff UTC, competition, status, neutral venue, deduplication fingerprint.
- `fixture_sources`: fixture provenance, source URL, fetched_at, payload hash, verification state.
- `team_form`, `team_match_stats`, `xg_observations`, `lineup_observations`, `injury_observations`, `odds_observations`: typed observations, each with source and timestamp.

## Model and scan
- `scan_runs`: requested date/timezone/scope, started/finished, provider coverage, counts, errors.
- `model_versions`: immutable model/config version and changelog.
- `predictions`: fixture, model version, market, selection, probabilities, coverage, sample size, rationale, missing inputs, status.
- `prediction_evaluations`: result, correctness, scored_at, Brier/log-loss contributions and evaluation version.
- `calibration_reports`: out-of-sample period, sample size, metrics and reliability bins.

## Coupons and paper finance
- `coupons`, `coupon_legs`: immutable snapshot of selection and odds at creation; unique fixture per coupon.
- `coupon_settlements`: idempotent settlement event and source provenance.
- `paper_ledger_transactions`: append-only stake/return/adjustment ledger.
- `odds_snapshots`: bookmaker, market, selection, decimal odds, source timestamp and fetched_at.
- `jackpot_pools`, `jackpot_entries`, `jackpot_entry_legs`: isolated from normal coupons and finance.

## Tracker and audit
- `tracker_categories`: owner-defined category tree and archive state.
- `tracker_annotations`: manual classifications and notes linked to source records.
- `audit_events`: actor, action, entity, before/after hashes, timestamp.
- `backup_manifests`: backup format version, counts, checksum and created_at.

## Data integrity constraints
- Unique provider fixture ID within provider.
- Unique coupon leg fixture within a coupon.
- Decimal odds > 1.0; probabilities in [0,1] and sum to 1 for complete 1X2 predictions.
- Kickoff stored in UTC; display in Europe/Brussels by default.
- All source observations preserve provider and retrieval timestamp.
- Settlement and ledger operations are transactional and idempotent.
- No deletes/overwrites of model predictions after publication; corrections create superseding records and audit events.
