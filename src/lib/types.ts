export type Market = "1X2" | "DOUBLE_CHANCE";
export type Selection1X2 = "1" | "X" | "2";
export type SelectionDC = "1X" | "X2" | "12";
export type Selection = Selection1X2 | SelectionDC;
export type Outcome = Selection1X2;
export type Verdict = "WYBRANY" | "ODRZUCONY";
export type Settlement = "pending" | "won" | "lost" | "void";
export type CouponStatus = Settlement | "cancelled";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
export type Gender = "men" | "women" | "mixed" | "unknown";
export type ScanRunStatus = "started" | "completed" | "partial" | "failed";
export type CouponType = "TEST" | "MAIN" | "MEGA" | "EXTRA";
export type TransactionType = "deposit" | "withdrawal" | "stake" | "return" | "adjustment";

export interface ScanRun {
  id: string;
  owner_id: string;
  scan_date: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  status: ScanRunStatus;
  matches_found: number;
  notes: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  owner_id: string;
  scan_run_id: string | null;
  external_id: string | null;
  source: string;
  competition: string | null;
  country: string | null;
  gender: Gender;
  home_team: string;
  away_team: string;
  kickoff_at: string | null;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
}

export interface Prediction {
  id: string;
  owner_id: string;
  match_id: string;
  model_version: string;
  market: Market;
  selection: Selection | "—";
  probability: number | null;
  confidence: string | null;
  verdict: Verdict;
  rationale: string | null;
  created_at: string;
  group_name: string;
  odds: number | null;
  settlement_status: Settlement;
  verified: boolean;
  note: string | null;
}

export interface Coupon {
  id: string;
  owner_id: string;
  scan_run_id: string | null;
  name: string;
  coupon_type: CouponType;
  status: CouponStatus;
  target_legs: 3;
  combined_odds: number | null;
  stake: number | null;
  potential_return: number | null;
  created_at: string;
  settled_at: string | null;
  notes: string | null;
}

export interface CouponLeg {
  id: string;
  owner_id: string;
  coupon_id: string;
  prediction_id: string;
  leg_number: 1 | 2 | 3;
  odds: number | null;
  status: Settlement;
  created_at: string;
}

export interface MatchResult {
  id: string;
  owner_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  outcome_1x2: Outcome;
  verified: boolean;
  source: string | null;
  finished_at: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface OddsSnapshot {
  id: string;
  owner_id: string;
  prediction_id: string;
  bookmaker: string;
  odds: number;
  captured_at: string;
  source_url: string | null;
}

export interface BankrollTransaction {
  id: string;
  owner_id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_after: number | null;
  coupon_id: string | null;
  occurred_at: string;
  note: string | null;
}

export interface TableRows {
  scan_runs: ScanRun;
  matches: Match;
  predictions: Prediction;
  coupons: Coupon;
  coupon_legs: CouponLeg;
  match_results: MatchResult;
  odds_snapshots: OddsSnapshot;
  bankroll_transactions: BankrollTransaction;
}
export type TableName = keyof TableRows;

/** Parent tables are inserted before their dependent records. */
export const TABLES_IN_ORDER: TableName[] = [
  "scan_runs",
  "matches",
  "match_results",
  "predictions",
  "odds_snapshots",
  "coupons",
  "coupon_legs",
  "bankroll_transactions",
];

export const TABLE_LABELS: Record<TableName, string> = {
  scan_runs: "Skany",
  matches: "Mecze",
  predictions: "Prognozy",
  coupons: "Kupony",
  coupon_legs: "Nogi kuponów",
  match_results: "Wyniki meczów",
  odds_snapshots: "Kursy",
  bankroll_transactions: "Transakcje bankrolla",
};
