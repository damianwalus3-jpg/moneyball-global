import type {
  BankrollTransaction,
  Match,
  Outcome,
  Pick as BetPick,
  Prediction,
  PredictionType,
  Settlement,
  TxType,
} from "./types";

export const COUPON_SIZE = 3;
/** Coupon candidates must be STRICTLY above this probability (in %). */
export const CANDIDATE_MIN_PROBABILITY = 75;

export const PICKS: Record<PredictionType, BetPick[]> = {
  "1X2": ["1", "X", "2"],
  DC: ["1X", "X2", "12"],
};

export const PICK_LABELS: Record<BetPick, string> = {
  "1": "1 · gospodarze",
  X: "X · remis",
  "2": "2 · goście",
  "1X": "1X · gosp. lub remis",
  X2: "X2 · remis lub goście",
  "12": "12 · bez remisu",
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
};

export const TX_LABELS: Record<TxType, string> = {
  deposit: "Wpłata",
  withdrawal: "Wypłata z konta",
  stake: "Stawka kuponu",
  payout: "Wygrana kuponu",
  adjustment: "Korekta (±)",
};

export function isValidPick(type: PredictionType, pick: string): pick is BetPick {
  return (PICKS[type] as string[]).includes(pick);
}

export function outcomeFromScore(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

export function settlePick(type: PredictionType, pick: BetPick, outcome: Outcome): "won" | "lost" {
  if (type === "1X2") return pick === outcome ? "won" : "lost";
  return pick.includes(outcome) ? "won" : "lost";
}

/** Coupon status from its legs: any lost -> lost, any pending -> pending, all void -> void, else won. */
export function couponStatus(legs: (Settlement | null | undefined)[]): Settlement {
  if (legs.length === 0) return "pending";
  const s = legs.map((l) => l ?? "pending");
  if (s.includes("lost")) return "lost";
  if (s.includes("pending")) return "pending";
  if (s.every((x) => x === "void")) return "void";
  return "won";
}

export function totalOdds(odds: (number | null | undefined)[]): number | null {
  if (odds.length === 0) return null;
  let t = 1;
  for (const o of odds) {
    if (o == null || !Number.isFinite(Number(o)) || Number(o) <= 1) return null;
    t *= Number(o);
  }
  return Math.round(t * 100) / 100;
}

/** Odds actually paid: void legs count as 1.00. */
export function effectiveOdds(
  legs: { odds: number | null; result_status: Settlement | null }[],
): number | null {
  return totalOdds(legs.filter((l) => l.result_status !== "void").map((l) => l.odds)) ??
    (legs.every((l) => l.result_status === "void") ? 1 : null);
}

/** Product of independent leg probabilities, in %. Model estimate, not a guarantee. */
export function combinedProbability(probs: (number | null | undefined)[]): number | null {
  if (probs.length === 0 || probs.some((p) => p == null)) return null;
  const v = probs.reduce<number>((acc, p) => acc * (Number(p) / 100), 1) * 100;
  return Math.round(v * 100) / 100;
}

export function impliedProbability(odds: number | null | undefined): number | null {
  if (odds == null || Number(odds) <= 1) return null;
  return Math.round((100 / Number(odds)) * 100) / 100;
}

export function isFinishedStatus(status: string | null | undefined) {
  return status === "finished" || status === "cancelled" || status === "postponed";
}

export function isCouponCandidate(p: Prediction, m: Match | undefined, nowMs: number): boolean {
  if (!m) return false;
  if (p.selection_status !== "WYBRANY") return false;
  if ((p.result_status ?? "pending") !== "pending") return false;
  if (p.probability == null || Number(p.probability) <= CANDIDATE_MIN_PROBABILITY) return false;
  if (isFinishedStatus(m.status)) return false;
  if (!m.kickoff_at || new Date(m.kickoff_at).getTime() <= nowMs) return false;
  return true;
}

/**
 * Builds up to `count` coupons of exactly 3 distinct matches.
 * One leg per match (highest probability), and no match is reused across the batch.
 */
export function buildCouponBatch<T extends Pick<Prediction, "match_id" | "probability">>(candidates: T[], count: number): T[][] {
  const best = new Map<string, T>();
  for (const c of candidates) {
    if (c.probability == null || Number(c.probability) <= CANDIDATE_MIN_PROBABILITY) continue;
    const cur = best.get(c.match_id);
    if (!cur || Number(c.probability) > Number(cur.probability)) best.set(c.match_id, c);
  }
  const sorted = [...best.values()].sort((a, b) => Number(b.probability) - Number(a.probability));
  const out: T[][] = [];
  for (let i = 0; i + COUPON_SIZE <= sorted.length && out.length < count; i += COUPON_SIZE) {
    out.push(sorted.slice(i, i + COUPON_SIZE));
  }
  return out;
}

export function validateCoupon(
  legs: { match_id: string; probability: number | null }[],
  usedMatchIds: Set<string> = new Set(),
): string[] {
  const errors: string[] = [];
  if (legs.length !== COUPON_SIZE) errors.push("Kupon musi mieć dokładnie 3 zdarzenia.");
  if (new Set(legs.map((l) => l.match_id)).size !== legs.length)
    errors.push("Każde zdarzenie musi dotyczyć innego meczu.");
  if (legs.some((l) => l.probability == null || Number(l.probability) <= CANDIDATE_MIN_PROBABILITY))
    errors.push("Wszystkie zdarzenia muszą mieć prawdopodobieństwo powyżej 75%.");
  if (legs.some((l) => usedMatchIds.has(l.match_id)))
    errors.push("Mecz jest już użyty w innym kuponie tej partii.");
  return errors;
}

export function validateBatch(coupons: { match_id: string; probability: number | null }[][]): string[] {
  const used = new Set<string>();
  const errors: string[] = [];
  coupons.forEach((legs, i) => {
    for (const e of validateCoupon(legs, used)) errors.push(`Kupon ${i + 1}: ${e}`);
    legs.forEach((l) => used.add(l.match_id));
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
  /** won / (won + lost) in %, null when nothing settled. */
  rate: number | null;
}

export function hitRate(statuses: (Settlement | null | undefined)[]): HitRate {
  const r = { total: statuses.length, won: 0, lost: 0, void: 0, pending: 0 };
  for (const s of statuses) r[(s ?? "pending") as Settlement]++;
  const settled = r.won + r.lost;
  return { ...r, settled, rate: settled ? Math.round((r.won / settled) * 1000) / 10 : null };
}

export function groupHitRates<T>(
  items: T[],
  keyFn: (t: T) => string,
  statusFn: (t: T) => Settlement | null | undefined,
): (HitRate & { key: string })[] {
  const groups = new Map<string, (Settlement | null | undefined)[]>();
  for (const it of items) {
    const k = keyFn(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(statusFn(it));
  }
  return [...groups.entries()]
    .map(([key, s]) => ({ key, ...hitRate(s) }))
    .sort((a, b) => b.settled - a.settled || a.key.localeCompare(b.key));
}

export const TX_SIGN: Record<TxType, 1 | -1> = {
  deposit: 1,
  withdrawal: -1,
  stake: -1,
  payout: 1,
  adjustment: 1,
};

/** Amounts are stored positive; the type decides direction. Adjustments keep their own sign. */
export function signedAmount(tx: Pick<BankrollTransaction, "type" | "amount">): number {
  const a = Number(tx.amount) || 0;
  if (tx.type === "adjustment") return a;
  return TX_SIGN[tx.type] * Math.abs(a);
}

/** Current bankroll, or null when there are no transactions ("brak danych"). */
export function bankrollBalance(txs: Pick<BankrollTransaction, "type" | "amount">[]): number | null {
  if (txs.length === 0) return null;
  return Math.round(txs.reduce((s, t) => s + signedAmount(t), 0) * 100) / 100;
}

export function couponPayout(
  stake: number | null,
  legs: { odds: number | null; result_status: Settlement | null }[],
): number | null {
  if (stake == null) return null;
  const st = couponStatus(legs.map((l) => l.result_status));
  if (st === "lost") return 0;
  if (st === "void") return Number(stake);
  if (st !== "won") return null;
  const o = effectiveOdds(legs);
  return o == null ? null : Math.round(Number(stake) * o * 100) / 100;
}
