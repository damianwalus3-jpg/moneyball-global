export type Market = "1X2" | "DOUBLE_CHANCE" | "GOALS";
export type Selection1X2 = "1" | "X" | "2";
export type SelectionDC = "1X" | "X2" | "12";
export type SelectionGoals = "BTTS_YES" | "BTTS_NO" | "OVER_1.5" | "UNDER_1.5" | "OVER_2.5" | "UNDER_2.5" | "OVER_3.5" | "UNDER_3.5";
export type Selection = Selection1X2 | SelectionDC | SelectionGoals;
export type Outcome = Selection1X2;
export type Verdict = "WYBRANY" | "ODRZUCONY";
export type Settlement = "pending" | "won" | "lost" | "void";
export type CouponStatus = Settlement | "cancelled";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
export type Gender = "men" | "women" | "mixed" | "unknown";
export type ScanRunStatus = "started" | "completed" | "partial" | "failed";
export type CouponType = "TEST" | "MAIN" | "MEGA" | "EXTRA";
export type TransactionType = "deposit" | "withdrawal" | "stake" | "return" | "adjustment";
// Legacy view-model aliases; the database still uses canonical columns.
export type PredictionType = "1X2" | "DC" | "GOALS";
export type SelectionStatus = Verdict;
export type TxType = "deposit" | "withdrawal" | "stake" | "payout" | "adjustment";

export interface ScanRun {
  id: string;
  owner_id: string;
  scan_date: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  status: ScanRunStatus;
  matches_found: number;
  matches_count?: number;
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
  gender: Gender | null;
  home_team: string;
  away_team: string;
  kickoff_at: string | null;
  kickoff_date?: string | null;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
  league?: string | null;
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
  prediction_type?: PredictionType;
  pick?: Selection | "—";
  selection_status?: Verdict;
  result_status?: Settlement;
  rejection_reason?: string | null;
  scan_run_id?: string | null;
  settled_at?: string | null;
  notes?: string | null;
  data_source?: string | null;
  data_coverage?: Record<string, unknown> | null;
}

export interface Coupon {
  id: string;
  owner_id: string;
  scan_run_id: string | null;
  name: string;
  coupon_type: CouponType;
  status: CouponStatus;
  target_legs: 1 | 3;
  combined_odds: number | null;
  stake: number | null;
  potential_return: number | null;
  created_at: string;
  settled_at: string | null;
  notes: string | null;
  total_odds?: number | null;
  combined_probability?: number | null;
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
  match_id?: string | null;
  prediction_type?: PredictionType;
  pick?: Selection | "—";
  probability?: number | null;
  result_status?: Settlement;
}

export interface MatchResult {
  id: string;
  owner_id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  outcome_1x2: Outcome | null;
  verified: boolean;
  source: string | null;
  finished_at: string | null;
  verified_at: string | null;
  created_at: string;
  home_goals?: number | null;
  away_goals?: number | null;
  settled_at?: string | null;
}

export interface OddsSnapshot {
  id: string;
  owner_id: string;
  prediction_id: string | null;
  bookmaker: string;
  odds: number;
  captured_at: string;
  source_url: string | null;
  match_id?: string | null;
  odds_1?: number | null;
  odds_x?: number | null;
  odds_2?: number | null;
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
  type?: TxType;
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
