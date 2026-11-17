import type { TableName } from "./types";

/**
 * Read allowlist for the active Supabase schema.
 * Legacy columns are intentionally omitted; canonical finance and match-link
 * fields used by statistics are explicitly included.
 */
export const OWNER_COLUMN = "owner_id" as const;

export const COLUMNS: Record<TableName, readonly string[]> = {
  scan_runs: ["id", "owner_id", "scan_date", "source", "started_at", "completed_at", "status", "matches_found", "notes", "created_at"],
  matches: ["id", "owner_id", "scan_run_id", "external_id", "source", "competition", "country", "gender", "home_team", "away_team", "kickoff_at", "status", "created_at", "updated_at"],
  predictions: ["id", "owner_id", "match_id", "model_version", "market", "selection", "probability", "confidence", "verdict", "rationale", "created_at", "group_name", "odds", "settlement_status", "verified", "note", "data_source", "data_coverage", "scan_run_id", "stake", "potential_return", "profit_loss", "decision_status", "source_class"],
  coupons: ["id", "owner_id", "scan_run_id", "name", "coupon_type", "status", "target_legs", "combined_odds", "stake", "potential_return", "created_at", "settled_at", "notes", "source_class"],
  coupon_legs: ["id", "owner_id", "coupon_id", "prediction_id", "leg_number", "odds", "status", "created_at", "match_id"],
  match_results: ["id", "owner_id", "match_id", "home_score", "away_score", "outcome_1x2", "verified", "source", "finished_at", "verified_at", "created_at"],
  odds_snapshots: ["id", "owner_id", "prediction_id", "bookmaker", "odds", "captured_at", "source_url"],
  bankroll_transactions: ["id", "owner_id", "transaction_type", "amount", "balance_after", "coupon_id", "occurred_at", "note"],
  moneyball_tracker_categories: ["id", "owner_id", "category_key", "display_name", "description", "category_group", "sort_order", "is_system", "is_active", "include_in_official_finance", "created_at"],
  moneyball_jackpot_entries: ["id", "owner_id", "sequence_no", "coupon_id", "title", "notes", "created_at"],
};

export function expectedColumns(table: TableName): readonly string[] {
  return COLUMNS[table];
}
