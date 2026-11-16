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
import { brusselsDayKey } from "./time";

export const COUPON_SIZE = 3;
export const CANDIDATE_MIN_PROBABILITY = 75;
export const ACTIVE_MODEL_VERSION = "MONEYBALL GLOBAL 3.8";

export function isActivePredictionVersion(version: string | null | undefined): boolean {
  return version === ACTIVE_MODEL_VERSION || (version ?? "").startsWith("MANUAL");
}

export const PICKS: Record<Market, Selection[]> = {
  "1X2": ["1", "X", "2"],
  DOUBLE_CHANCE: ["1X", "X2", "12"],
  GOALS: ["BTTS_YES", "BTTS_NO", "OVER_1.5", "UNDER_1.5", "OVER_2.5", "UNDER_2.5", "OVER_3.5", "UNDER_3.5"],
};

export const PICK_LABELS: Record<Selection, string> = {
  "1": "1 · gospodarze",
  X: "X · remis",
  "2": "2 · goście",
  "1X": "1X · gospodarze lub remis",
  X2: "X2 · remis lub goście",
  "12": "12 · bez remisu",
  BTTS_YES: "BTTS TAK · obie strzelą",
  BTTS_NO: "BTTS NIE · nie obie strzelą",
  "OVER_1.5": "Powyżej 1,5 gola",
  "UNDER_1.5": "Poniżej 1,5 gola",
  "OVER_2.5": "Powyżej 2,5 gola",
  "UNDER_2.5": "Poniżej 2,5 gola",
  "OVER_3.5": "Powyżej 3,5 gola",
  "UNDER_3.5": "Poniżej 3,5 gola",
};

export const MARKET_LABELS: Record<Market, string> = {
  "1X2": "1X2",
  DOUBLE_CHANCE: "Double Chance",
  GOALS: "Gole / BTTS",
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
  if (market === "GOALS") throw new Error("Rynek GOALS wymaga dokładnego wyniku bramkowego.");
  if (market === "1X2") return selection === outcome ? "won" : "lost";
  if (selection === "1X") return outcome === "1" || outcome === "X" ? "won" : "lost";
  if (selection === "X2") return outcome === "X" || outcome === "2" ? "won" : "lost";
  return outcome === "1" || outcome === "2" ? "won" : "lost";
}

export function settleGoalsPick(selection: Selection, home: number, away: number): "won" | "lost" {
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0)
    throw new Error("Wynik bramkowy musi zawierać nieujemne liczby całkowite.");
  const total = home + away;
  switch (selection) {
    case "BTTS_YES": return home > 0 && away > 0 ? "won" : "lost";
    case "BTTS_NO": return home === 0 || away === 0 ? "won" : "lost";
    case "OVER_1.5": return total >= 2 ? "won" : "lost";
    case "UNDER_1.5": return total <= 1 ? "won" : "lost";
    case "OVER_2.5": return total >= 3 ? "won" : "lost";
    case "UNDER_2.5": return total <= 2 ? "won" : "lost";
    case "OVER_3.5": return total >= 4 ? "won" : "lost";
    case "UNDER_3.5": return total <= 3 ? "won" : "lost";
    default: throw new Error("Nieprawidłowy typ rynku GOALS.");
  }
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

const EUROPEAN_COUNTRIES = new Set([
  "albania","andorra","armenia","austria","azerbaijan","belarus","belgium","bosnia and herzegovina",
  "bulgaria","croatia","cyprus","czechia","czech republic","denmark","england","estonia","faroe islands",
  "finland","france","georgia","germany","gibraltar","greece","hungary","iceland","ireland","isle of man",
  "italy","kazakhstan","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco",
  "montenegro","netherlands","north macedonia","northern ireland","norway","poland","portugal","romania",
  "russia","san marino","scotland","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey",
  "türkiye","ukraine","wales","united kingdom","uk","alb","and","arm","aut","aze","blr","bel","bih","bul",
  "cro","cyp","cze","dnk","eng","est","fro","fin","fra","geo","deu","ger","gib","grc","gre","hun","isl",
  "irl","ita","kaz","kos","lva","lie","ltu","lux","mlt","mda","mne","nld","mkd","nir","nor","pol","prt",
  "por","rou","rus","smr","sco","srb","svk","svn","esp","swe","che","sui","tur","ukr","wal","gbr"
]);

/** True only for European domestic first- or second-tier leagues (no cups, youth or lower divisions). */
export function isEuropeanTopTwoLeague(country: string | null | undefined, competition: string | null | undefined): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const c = normalize(String(country ?? ""));
  const league = normalize(String(competition ?? ""));
  if (!EUROPEAN_COUNTRIES.has(c) || !league) return false;
  if (/\\b(u(?:17|18|19|20|21|23)|under ?(?:17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|cup|copa|trophy|play-?offs?)\\b/.test(league)) return false;
  if (/\\bdruha liga\\b|\\b(3|4|5|6|7|8|9|iii|iv|v|vi)\\s*\\.?\\s*(liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)\\b|\\b(third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\\b/.test(league)) return false;
  return /\\b(premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|segunda division|segunda liga|eredivisie|keuken kampioen divisie|primeira liga|ekstraklasa|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|prva liga|persha liga|liga e pare|hnl|1 hnl|2 hnl|first league|second league|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|virsliga|meistriliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|premier division|league of ireland premier|league of ireland first|scottish championship)\\b/.test(league);
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

/** Coupons are built only from matches kicking off today (Europe/Brussels calendar day). */
export function isKickoffToday(kickoffAt: string | null | undefined, nowMs: number): boolean {
  if (!kickoffAt) return false;
  const kickoff = new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return false;
  return brusselsDayKey(kickoff) === brusselsDayKey(new Date(nowMs));
}

/** Running balance after each new stake, continuing from the existing ledger (no ledger = 0). */
export function stakeBalances(existing: BankrollTransaction[], stake: number, count: number): number[] {
  let balance = bankrollBalance(existing) ?? 0;
  return Array.from({ length: count }, () => (balance = Math.round((balance - Math.abs(stake)) * 100) / 100));
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
  legs: { match_id: string; probability: number | null; odds?: number | null }[],
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

/**
 * Overall model hit rate for one market: every valid pick of the active model
 * counts, regardless of the coupon verdict (WYBRANY/ODRZUCONY). Only won/lost
 * enter the rate; pending and void do not.
 */
export function modelHitRate(
  predictions: Pick<Prediction, "market" | "selection" | "settlement_status" | "model_version">[],
  market: "1X2" | "DOUBLE_CHANCE",
): HitRate {
  return hitRate(
    predictions
      .filter((p) => p.market === market && isValidPick(market, p.selection) && isActivePredictionVersion(p.model_version))
      .map((p) => p.settlement_status),
  );
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
