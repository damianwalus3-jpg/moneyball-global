import type {
  BankrollTransaction,
  CouponLeg,
  Match,
  Outcome,
  Selection,
  Market,
  Prediction,
  Settlement,
  CouponStatus,
  TransactionType,
} from "./types";

export const COUPON_SIZE = 3;
export const CANDIDATE_MIN_PROBABILITY = 75;
export const ACTIVE_MODEL_VERSION = "MONEYBALL GLOBAL 3.8";

export function isActivePredictionVersion(version: string | null | undefined): boolean {
  return version === ACTIVE_MODEL_VERSION || (version ?? "").startsWith("MANUAL");
}

export const PICKS: Record<Market, Selection[]> = {
  "1X2": ["1", "X", "2"],
  DOUBLE_CHANCE: ["1X", "X2", "12"],
};

export const PICK_LABELS: Record<Selection, string> = {
  "1": "1 · gospodarze",
  X: "X · remis",
  "2": "2 · goście",
  "1X": "1X · gospodarze lub remis",
  X2: "X2 · remis lub goście",
  "12": "12 · bez remisu",
};

export const MARKET_LABELS: Record<Market, string> = {
  "1X2": "1X2",
  DOUBLE_CHANCE: "Double Chance",
};

export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  pending: "Oczekuje",
  won: "Wygrany",
  lost: "Przegrany",
  void: "Zwrot",
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: "Zaplanowany",
  live: "W trakcie",
  finished: "Zakończony",
  postponed: "Przełożony",
  cancelled: "Odwołany",
  unknown: "Nieznany",
};

export const TX_LABELS: Record<TransactionType, string> = {
  deposit: "Wpłata",
  withdrawal: "Wypłata z konta",
  stake: "Stawka kuponu",
  return: "Zwrot / wygrana",
  adjustment: "Korekta (±)",
};

export function isValidPick(market: Market | null | undefined, selection: string | null | undefined): selection is Selection {
  if (typeof market !== "string" || typeof selection !== "string") return false;
  const allowed = PICKS[market as Market];
  return Array.isArray(allowed) && (allowed as string[]).includes(selection);
}

export function outcomeFromScore(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

export function settlePick(market: Market, selection: Selection, outcome: Outcome): "won" | "lost" {
  if (market === "1X2") return selection === outcome ? "won" : "lost";
  if (selection === "1X") return outcome === "1" || outcome === "X" ? "won" : "lost";
  if (selection === "X2") return outcome === "X" || outcome === "2" ? "won" : "lost";
  return outcome === "1" || outcome === "2" ? "won" : "lost";
}

export function couponStatus(legs: (Settlement | null | undefined)[]): Settlement {
  if (legs.length !== 1 && legs.length !== COUPON_SIZE) return "pending";
  const statuses = legs.map((status) => status ?? "pending");
  if (statuses.includes("lost")) return "lost";
  if (statuses.includes("pending")) return "pending";
  if (statuses.every((status) => status === "void")) return "void";
  return "won";
}

export function totalOdds(odds: (number | null | undefined)[]): number | null {
  if ((odds.length !== 1 && odds.length !== COUPON_SIZE) || odds.some((odd) => odd == null || !Number.isFinite(Number(odd)) || Number(odd) <= 1))
    return null;
  const total = odds.reduce<number>((acc, odd) => acc * Number(odd), 1);
  return Math.round(total * 100) / 100;
}

/** Void legs are treated as 1.00 when calculating the final coupon price. */
export function effectiveOdds(legs: Pick<CouponLeg, "odds" | "status">[]): number | null {
  if (legs.length !== 1 && legs.length !== COUPON_SIZE) return null;
  const activeOdds = legs.filter((leg) => leg.status !== "void").map((leg) => leg.odds);
  if (activeOdds.length === 0) return 1;
  if (activeOdds.some((odd) => odd == null || Number(odd) <= 1)) return null;
  return Math.round(activeOdds.reduce<number>((acc, odd) => acc * Number(odd), 1) * 100) / 100;
}

export function combinedProbability(probabilities: (number | null | undefined)[]): number | null {
  if ((probabilities.length !== 1 && probabilities.length !== COUPON_SIZE) || probabilities.some((p) => p == null || Number(p) < 0 || Number(p) > 100))
    return null;
  const result = probabilities.reduce<number>((acc, probability) => acc * (Number(probability) / 100), 1) * 100;
  return Math.round(result * 100) / 100;
}

export function impliedProbability(odds: number | null | undefined): number | null {
  if (odds == null || !Number.isFinite(Number(odds)) || Number(odds) <= 1) return null;
  return Math.round((100 / Number(odds)) * 100) / 100;
}

export function isFinishedStatus(status: string | null | undefined) {
  return status === "finished" || status === "cancelled" || status === "postponed";
}

export function isCouponCandidate(prediction: Prediction, match: Match | undefined, nowMs: number): boolean {
  if (!match) return false;
  if (prediction.verdict !== "WYBRANY") return false;
  if (prediction.settlement_status !== "pending") return false;
  if (prediction.probability == null || Number(prediction.probability) <= CANDIDATE_MIN_PROBABILITY) return false;
  if (isFinishedStatus(match.status) || match.status === "live") return false;
  if (!match.kickoff_at || new Date(match.kickoff_at).getTime() <= nowMs) return false;
  return prediction.selection !== "—" && isValidPick(prediction.market, prediction.selection);
}

export function buildCouponBatch<T extends { match_id: string; probability: number | null }>(
  candidates: T[],
  count: number,
): T[][] {
  const bestByMatch = new Map<string, T>();
  for (const candidate of candidates) {
    if (candidate.probability == null || Number(candidate.probability) <= CANDIDATE_MIN_PROBABILITY) continue;
    const current = bestByMatch.get(candidate.match_id);
    if (!current || Number(candidate.probability) > Number(current.probability))
      bestByMatch.set(candidate.match_id, candidate);
  }
  const sorted = [...bestByMatch.values()].sort((a, b) => Number(b.probability) - Number(a.probability));
  const result: T[][] = [];
  for (let index = 0; index + COUPON_SIZE <= sorted.length && result.length < count; index += COUPON_SIZE)
    result.push(sorted.slice(index, index + COUPON_SIZE));
  return result;
}

export function buildSingleCouponBatch<T extends { match_id: string; probability: number | null }>(
  candidates: T[],
  count: number,
): T[][] {
  const bestByMatch = new Map<string, T>();
  for (const candidate of candidates) {
    if (candidate.probability == null || Number(candidate.probability) <= CANDIDATE_MIN_PROBABILITY) continue;
    const current = bestByMatch.get(candidate.match_id);
    if (!current || Number(candidate.probability) > Number(current.probability))
      bestByMatch.set(candidate.match_id, candidate);
  }
  return [...bestByMatch.values()]
    .sort((a, b) => Number(b.probability) - Number(a.probability))
    .slice(0, Math.max(0, Math.floor(count)))
    .map((candidate) => [candidate]);
}

export function validateCoupon(
  legs: { match_id: string; probability: number | null }[],
  usedMatchIds: Set<string> = new Set(),
  targetLegs: 1 | 3 = COUPON_SIZE,
  requireOdds = false,
): string[] {
  const errors: string[] = [];
  if (legs.length !== targetLegs)
    errors.push(targetLegs === 1 ? "Kupon pojedynczy musi mieć dokładnie 1 zdarzenie." : "Kupon musi mieć dokładnie 3 zdarzenia.");
  if (new Set(legs.map((leg) => leg.match_id)).size !== legs.length)
    errors.push("Każde zdarzenie musi dotyczyć innego meczu.");
  if (legs.some((leg) => leg.probability == null || Number(leg.probability) <= CANDIDATE_MIN_PROBABILITY))
    errors.push("Wszystkie zdarzenia muszą mieć prawdopodobieństwo powyżej 75%.");
  if (legs.some((leg) => usedMatchIds.has(leg.match_id)))
    errors.push("Mecz jest już użyty w innym kuponie tej partii.");
  if (requireOdds && legs.some((leg) => leg.odds == null || !Number.isFinite(Number(leg.odds)) || Number(leg.odds) <= 1))
    errors.push("Kupon MAIN/MEGA/EXTRA wymaga potwierdzonego kursu większego niż 1,00 dla każdego zdarzenia.");
  return errors;
}

export function validateBatch(coupons: { match_id: string; probability: number | null; odds?: number | null }[][], targetLegs: 1 | 3 = COUPON_SIZE, requireOdds = false): string[] {
  const used = new Set<string>();
  const errors: string[] = [];
  coupons.forEach((legs, index) => {
    for (const error of validateCoupon(legs, used, targetLegs, requireOdds)) errors.push(`Kupon ${index + 1}: ${error}`);
    legs.forEach((leg) => used.add(leg.match_id));
  });
  return errors;
}

export interface HitRate {
  total: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  settled: number;
  rate: number | null;
}

export function hitRate(statuses: (Settlement | CouponStatus | null | undefined)[]): HitRate {
  const result = { total: statuses.length, won: 0, lost: 0, void: 0, pending: 0 };
  for (const status of statuses) result[(status === "cancelled" ? "void" : status ?? "pending") as Settlement]++;
  const settled = result.won + result.lost;
  return { ...result, settled, rate: settled ? Math.round((result.won / settled) * 1000) / 10 : null };
}

export function groupHitRates<T>(
  items: T[],
  keyFn: (item: T) => string,
  statusFn: (item: T) => Settlement | CouponStatus | null | undefined,
): (HitRate & { key: string })[] {
  const groups = new Map<string, (Settlement | CouponStatus | null | undefined)[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(statusFn(item));
  }
  return [...groups.entries()]
    .map(([key, statuses]) => ({ key, ...hitRate(statuses) }))
    .sort((a, b) => b.settled - a.settled || a.key.localeCompare(b.key));
}

export const TX_SIGN: Record<TransactionType, 1 | -1> = {
  deposit: 1,
  withdrawal: -1,
  stake: -1,
  return: 1,
  adjustment: 1,
};

/** Transaction amounts are positive except adjustment, whose sign is preserved. */
export function signedAmount(transaction: Pick<BankrollTransaction, "transaction_type" | "amount">): number {
  const amount = Number(transaction.amount) || 0;
  if (transaction.transaction_type === "adjustment") return amount;
  return TX_SIGN[transaction.transaction_type] * Math.abs(amount);
}

/** Uses the latest stored balance_after; falls back to the signed ledger. */
export function bankrollBalance(transactions: BankrollTransaction[]): number | null {
  if (transactions.length === 0) return null;
  const ordered = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const latest = [...ordered].reverse().find((transaction) => transaction.balance_after != null);
  if (latest?.balance_after != null) return Math.round(Number(latest.balance_after) * 100) / 100;
  return Math.round(ordered.reduce((sum, transaction) => sum + signedAmount(transaction), 0) * 100) / 100;
}

export function couponPayout(
  stake: number | null,
  legs: Pick<CouponLeg, "odds" | "status">[],
): number | null {
  if (stake == null || (legs.length !== 1 && legs.length !== COUPON_SIZE)) return null;
  const status = couponStatus(legs.map((leg) => leg.status));
  if (status === "lost") return 0;
  if (status === "void") return Number(stake);
  if (status !== "won") return null;
  const odds = effectiveOdds(legs);
  return odds == null ? null : Math.round(Number(stake) * odds * 100) / 100;
}
