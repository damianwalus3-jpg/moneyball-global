-- MONEYBALL GLOBAL: Cloudflare D1 schema (SQLite)
-- Initial portable schema. IDs are preserved as TEXT UUIDs during migration.
-- Do not point production traffic at D1 until data import and auth cutover are validated.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1))
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS app_sessions_user_expiry_idx ON app_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  scan_date TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'FootyNomad',
  started_at TEXT NOT NULL, completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  matches_found INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL,
  matches_count INTEGER
);
CREATE INDEX IF NOT EXISTS scan_runs_owner_date_idx ON scan_runs(owner_id, scan_date);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  scan_run_id TEXT REFERENCES scan_runs(id),
  external_id TEXT, source TEXT NOT NULL, competition TEXT, country TEXT, gender TEXT,
  home_team TEXT NOT NULL, away_team TEXT NOT NULL, kickoff_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT NOT NULL, updated_at TEXT,
  league TEXT, notes TEXT, kickoff_date TEXT
);
CREATE INDEX IF NOT EXISTS matches_owner_kickoff_idx ON matches(owner_id, kickoff_at);
CREATE INDEX IF NOT EXISTS matches_owner_external_idx ON matches(owner_id, source, external_id);
CREATE INDEX IF NOT EXISTS matches_owner_scan_idx ON matches(owner_id, scan_run_id);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  match_id TEXT NOT NULL REFERENCES matches(id), model_version TEXT NOT NULL,
  market TEXT NOT NULL, selection TEXT NOT NULL, probability REAL, confidence TEXT,
  verdict TEXT NOT NULL DEFAULT 'ODRZUCONY', rationale TEXT, created_at TEXT NOT NULL,
  group_name TEXT, odds REAL, settlement_status TEXT NOT NULL DEFAULT 'pending',
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)), note TEXT,
  data_source TEXT, data_coverage TEXT, prediction_type TEXT, pick TEXT,
  selection_status TEXT, rejection_reason TEXT, result_status TEXT, settled_at TEXT,
  notes TEXT, scan_run_id TEXT REFERENCES scan_runs(id),
  stake REAL NOT NULL DEFAULT 5.00, potential_return REAL, profit_loss REAL
);
CREATE INDEX IF NOT EXISTS predictions_owner_match_idx ON predictions(owner_id, match_id);
CREATE INDEX IF NOT EXISTS predictions_owner_market_idx ON predictions(owner_id, market, settlement_status);
CREATE INDEX IF NOT EXISTS predictions_match_model_market_pick_idx ON predictions(match_id, model_version, market, selection);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  scan_run_id TEXT REFERENCES scan_runs(id), name TEXT NOT NULL,
  coupon_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  target_legs INTEGER NOT NULL CHECK (target_legs IN (1,3)),
  combined_odds REAL, stake REAL, potential_return REAL, created_at TEXT NOT NULL,
  settled_at TEXT, notes TEXT, batch_id TEXT, total_odds REAL, combined_probability REAL
);
CREATE INDEX IF NOT EXISTS coupons_owner_status_idx ON coupons(owner_id, status, created_at);

CREATE TABLE IF NOT EXISTS coupon_legs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  prediction_id TEXT NOT NULL REFERENCES predictions(id), leg_number INTEGER NOT NULL,
  odds REAL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL,
  match_id TEXT REFERENCES matches(id), prediction_type TEXT, pick TEXT,
  probability REAL, result_status TEXT,
  UNIQUE(coupon_id, leg_number)
);
CREATE INDEX IF NOT EXISTS coupon_legs_owner_coupon_idx ON coupon_legs(owner_id, coupon_id);
CREATE INDEX IF NOT EXISTS coupon_legs_prediction_idx ON coupon_legs(prediction_id);

CREATE TABLE IF NOT EXISTS match_results (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  match_id TEXT NOT NULL REFERENCES matches(id), home_score INTEGER, away_score INTEGER,
  outcome_1x2 TEXT, verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  source TEXT, finished_at TEXT, verified_at TEXT, created_at TEXT NOT NULL,
  home_goals INTEGER, away_goals INTEGER, settled_at TEXT, notes TEXT,
  UNIQUE(owner_id, match_id)
);
CREATE INDEX IF NOT EXISTS match_results_owner_verified_idx ON match_results(owner_id, verified, match_id);

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  prediction_id TEXT REFERENCES predictions(id), bookmaker TEXT NOT NULL,
  odds REAL NOT NULL, captured_at TEXT NOT NULL, source_url TEXT,
  match_id TEXT REFERENCES matches(id), odds_1 REAL, odds_x REAL, odds_2 REAL,
  odds_1x REAL, odds_x2 REAL, odds_12 REAL
);
CREATE INDEX IF NOT EXISTS odds_snapshots_owner_time_idx ON odds_snapshots(owner_id, captured_at);
CREATE INDEX IF NOT EXISTS odds_snapshots_match_time_idx ON odds_snapshots(match_id, captured_at);

CREATE TABLE IF NOT EXISTS bankroll_transactions (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  transaction_type TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL,
  coupon_id TEXT REFERENCES coupons(id), occurred_at TEXT NOT NULL, note TEXT, type TEXT
);
CREATE INDEX IF NOT EXISTS bankroll_owner_time_idx ON bankroll_transactions(owner_id, occurred_at);

-- Feed, provider quote and source metadata retained for the scanner pipeline.
CREATE TABLE IF NOT EXISTS moneyball_global_scan_runs (
  id TEXT PRIMARY KEY, scan_date TEXT NOT NULL, source TEXT, status TEXT,
  matches_reported INTEGER, fixtures_count INTEGER, duplicates_removed INTEGER,
  fetched_at TEXT, notes TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS moneyball_global_fixture_feed (
  scan_date TEXT NOT NULL, external_id TEXT NOT NULL, source TEXT, competition TEXT,
  country TEXT, gender TEXT, home_team TEXT, away_team TEXT, kickoff_at TEXT,
  status TEXT, home_score INTEGER, away_score INTEGER, fetched_at TEXT, raw TEXT,
  PRIMARY KEY(scan_date, external_id)
);
CREATE TABLE IF NOT EXISTS match_market_data (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  match_id TEXT NOT NULL REFERENCES matches(id), source TEXT,
  provider_data TEXT, captured_at TEXT
);
CREATE INDEX IF NOT EXISTS match_market_data_owner_match_idx ON match_market_data(owner_id, match_id);
CREATE TABLE IF NOT EXISTS provider_odds (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES app_users(id),
  match_id TEXT REFERENCES matches(id), provider TEXT, provider_fixture_id TEXT,
  bookmaker TEXT, sport TEXT, market_group_id TEXT, market_id TEXT, market_name TEXT,
  selection_id TEXT, selection_label TEXT, selection_side TEXT, selection_line TEXT,
  selection_handicap REAL, odds REAL, suspended INTEGER, phase TEXT,
  price_timestamp TEXT, provider_polled_at TEXT, captured_at TEXT, raw_quote TEXT,
  mapped_market TEXT, mapped_selection TEXT
);
CREATE INDEX IF NOT EXISTS provider_odds_match_market_idx ON provider_odds(match_id, mapped_market, mapped_selection);
CREATE TABLE IF NOT EXISTS match_result_sources (
  id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id),
  source TEXT, external_match_id TEXT, source_status TEXT,
  home_score INTEGER, away_score INTEGER, source_url TEXT, fetched_at TEXT, raw TEXT
);
CREATE INDEX IF NOT EXISTS match_result_sources_match_idx ON match_result_sources(match_id, fetched_at);
CREATE TABLE IF NOT EXISTS mb_project_sources (
  id TEXT PRIMARY KEY, source_name TEXT NOT NULL, role TEXT, enabled INTEGER,
  coverage TEXT, access_notes TEXT, status TEXT, updated_at TEXT
);
