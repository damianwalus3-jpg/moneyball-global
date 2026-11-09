export type PredictionType = "1X2" | "DC";
export type Pick1X2 = "1" | "X" | "2";
export type PickDC = "1X" | "X2" | "12";
export type Pick = Pick1X2 | PickDC;
export type Outcome = Pick1X2;
export type SelectionStatus = "WYBRANY" | "ODRZUCONY";
export type Settlement = "pending" | "won" | "lost" | "void";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
export type TxType = "deposit" | "withdrawal" | "stake" | "payout" | "adjustment";

export interface ScanRun {
  id: string;
  started_at: string | null;
  source: string | null;
  notes: string | null;
  matches_count: number | null;
  created_at: string | null;
}

export interface Match {
  id: string;
  scan_run_id: string | null;
  kickoff_at: string | null;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  status: MatchStatus | null;
  external_id: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface Prediction {
  id: string;
  match_id: string;
  scan_run_id: string | null;
  prediction_type: PredictionType;
  pick: Pick;
  probability: number | null;
  confidence: string | null;
  odds: number | null;
  selection_status: SelectionStatus | null;
  rejection_reason: string | null;
  result_status: Settlement | null;
  settled_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface Coupon {
  id: string;
  name: string | null;
  batch_id: string | null;
  stake: number | null;
  total_odds: number | null;
  combined_probability: number | null;
  status: Settlement | null;
  settled_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface CouponLeg {
  id: string;
  coupon_id: string;
  prediction_id: string | null;
  match_id: string;
  prediction_type: PredictionType;
  pick: Pick;
  probability: number | null;
  odds: number | null;
  result_status: Settlement | null;
  created_at: string | null;
}

export interface MatchResult {
  id: string;
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  outcome_1x2: Outcome | null;
  source: string | null;
  settled_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface OddsSnapshot {
  id: string;
  match_id: string;
  bookmaker: string | null;
  captured_at: string | null;
  odds_1: number | null;
  odds_x: number | null;
  odds_2: number | null;
  odds_1x: number | null;
  odds_x2: number | null;
  odds_12: number | null;
  created_at: string | null;
}

export interface BankrollTransaction {
  id: string;
  occurred_at: string | null;
  type: TxType;
  amount: number;
  coupon_id: string | null;
  note: string | null;
  created_at: string | null;
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

/** Insert order respects foreign keys (parents first). */
export const TABLES_IN_ORDER: TableName[] = [
  "scan_runs",
  "matches",
  "odds_snapshots",
  "match_results",
  "predictions",
  "coupons",
  "coupon_legs",
  "bankroll_transactions",
];

export const TABLE_LABELS: Record<TableName, string> = {
  scan_runs: "Skany",
  matches: "Mecze",
  predictions: "Prognozy",
  coupons: "Kupony",
  coupon_legs: "Zdarzenia kuponów",
  match_results: "Wyniki meczów",
  odds_snapshots: "Kursy (snapshoty)",
  bankroll_transactions: "Transakcje bankrolla",
};
