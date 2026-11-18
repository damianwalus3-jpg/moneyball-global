import type { TrackerRecord } from "./tracker-store";
export type CouponSelection = "1" | "X" | "2" | "1X" | "X2" | "12";
export interface PaperCouponSettlement {
  couponId: string; status: "PAPER_HIT" | "PAPER_MISS"; correctLegs: number; totalLegs: 3;
  legResults: Array<{ fixtureId: string; selection: CouponSelection; actual: "1" | "X" | "2"; correct: boolean; market: "1X2" | "DOUBLE_CHANCE" }>;
}
function selectionWins(selection: CouponSelection, actual: "1" | "X" | "2"): boolean {
  if (selection === "1X") return actual === "1" || actual === "X";
  if (selection === "X2") return actual === "X" || actual === "2";
  if (selection === "12") return actual === "1" || actual === "2";
  return selection === actual;
}
export function evaluatePaperCoupon(coupon: TrackerRecord, records: TrackerRecord[]): PaperCouponSettlement | null {
  if (coupon.kind !== "coupon" || !["PAPER_NO_ODDS", "PAPER_WITH_ODDS"].includes(coupon.status) || typeof coupon.details.legsJson !== "string") return null;
  let legs: Array<{ fixtureId: string; selection: CouponSelection; market?: "1X2" | "DOUBLE_CHANCE" }>;
  try {
    const parsed: unknown = JSON.parse(coupon.details.legsJson);
    if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every(leg => leg && typeof leg === "object"
      && typeof leg.fixtureId === "string" && ["1","X","2","1X","X2","12"].includes(leg.selection))) return null;
    legs = parsed as typeof legs;
  } catch { return null; }
  if (new Set(legs.map(leg => leg.fixtureId)).size !== 3) return null;
  const resultMap = new Map<string, "1" | "X" | "2">();
  for (const record of records) {
    if (record.kind !== "result" || typeof record.details.fixtureId !== "string" || resultMap.has(record.details.fixtureId)) continue;
    const actual = record.details.actual;
    if (actual === "1" || actual === "X" || actual === "2") resultMap.set(record.details.fixtureId, actual);
  }
  const legResults = legs.flatMap(leg => {
    const actual = resultMap.get(leg.fixtureId); if (!actual) return [];
    const market = leg.market ?? (["1X", "X2", "12"].includes(leg.selection) ? "DOUBLE_CHANCE" : "1X2");
    return [{ fixtureId: leg.fixtureId, selection: leg.selection, actual, correct: selectionWins(leg.selection, actual), market }];
  });
  if (legResults.length !== 3) return null;
  const correctLegs = legResults.filter(leg => leg.correct).length;
  return { couponId: coupon.id, status: correctLegs === 3 ? "PAPER_HIT" : "PAPER_MISS", correctLegs, totalLegs: 3, legResults };
}
export function buildPaperCouponSettlementRecord(coupon: TrackerRecord, settlement: PaperCouponSettlement): Omit<TrackerRecord, "id" | "createdAt"> {
  const rawOdds = coupon.details.odds, rawStake = coupon.details.stake;
  const priced = coupon.status === "PAPER_WITH_ODDS" && typeof rawOdds === "number" && Number.isFinite(rawOdds) && rawOdds > 1
    && typeof rawStake === "number" && Number.isFinite(rawStake) && rawStake > 0;
  const odds = priced ? rawOdds as number : null, stake = priced ? rawStake as number : null;
  const hit = settlement.status === "PAPER_HIT";
  const potentialReturn = priced ? (hit ? stake! * odds! : 0) : null;
  const profitLoss = priced ? (hit ? stake! * (odds! - 1) : -stake!) : null;
  return { kind: "coupon", title: coupon.title + " · " + settlement.correctLegs + "/3", status: settlement.status,
    details: { parentCouponId: coupon.id, correctLegs: settlement.correctLegs, totalLegs: settlement.totalLegs,
      legResultsJson: JSON.stringify(settlement.legResults), bookmaker: priced ? coupon.details.bookmaker ?? null : null,
      odds, stake, profitLoss, potentialReturn } };
}
