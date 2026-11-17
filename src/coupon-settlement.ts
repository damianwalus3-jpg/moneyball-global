import type { TrackerRecord } from "./tracker-store";

export interface PaperCouponSettlement {
  couponId: string;
  status: "PAPER_HIT" | "PAPER_MISS";
  correctLegs: number;
  totalLegs: 3;
  legResults: Array<{ fixtureId: string; selection: "1" | "X" | "2"; actual: "1" | "X" | "2"; correct: boolean }>;
}
export function evaluatePaperCoupon(coupon: TrackerRecord, records: TrackerRecord[]): PaperCouponSettlement | null {
  if (coupon.kind !== "coupon" || !["PAPER_NO_ODDS", "PAPER_WITH_ODDS"].includes(coupon.status) || typeof coupon.details.legsJson !== "string") return null;
  let legs: Array<{ fixtureId: string; selection: "1" | "X" | "2" }>;
  try {
    const parsed: unknown = JSON.parse(coupon.details.legsJson);
    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    if (!parsed.every(leg => leg && typeof leg === "object" && typeof leg.fixtureId === "string" && ["1","X","2"].includes(leg.selection))) return null;
    legs = parsed as typeof legs;
  } catch { return null; }
  if (new Set(legs.map(leg => leg.fixtureId)).size !== 3) return null;
  const resultMap = new Map<string, "1" | "X" | "2">();
  for (const record of records) {
    if (record.kind !== "result" || typeof record.details.fixtureId !== "string" || resultMap.has(record.details.fixtureId)) continue;
    const actual = record.details.actual;
    // Tracker is newest-first: retain the newest valid settlement per fixture.
    if (actual === "1" || actual === "X" || actual === "2") resultMap.set(record.details.fixtureId, actual);
  }
  const legResults = legs.flatMap(leg => {
    const actual = resultMap.get(leg.fixtureId);
    return actual ? [{ fixtureId: leg.fixtureId, selection: leg.selection, actual, correct: leg.selection === actual }] : [];
  });
  if (legResults.length !== 3) return null;
  const correctLegs = legResults.filter(leg => leg.correct).length;
  return { couponId: coupon.id, status: correctLegs === 3 ? "PAPER_HIT" : "PAPER_MISS", correctLegs, totalLegs: 3, legResults };
}


/** Builds an append-only Tracker row with verified paper P/L; legacy unpriced coupons retain null financial values. */
export function buildPaperCouponSettlementRecord(
  coupon: TrackerRecord,
  settlement: PaperCouponSettlement,
): Omit<TrackerRecord, "id" | "createdAt"> {
  const rawOdds = coupon.details.odds;
  const rawStake = coupon.details.stake;
  const priced = coupon.status === "PAPER_WITH_ODDS"
    && typeof rawOdds === "number" && Number.isFinite(rawOdds) && rawOdds > 1
    && typeof rawStake === "number" && Number.isFinite(rawStake) && rawStake > 0;
  const odds = priced ? rawOdds as number : null;
  const stake = priced ? rawStake as number : null;
  const hit = settlement.status === "PAPER_HIT";
  const potentialReturn = priced ? (hit ? stake! * odds! : 0) : null;
  const profitLoss = priced ? (hit ? stake! * (odds! - 1) : -stake!) : null;
  return {
    kind: "coupon",
    title: `${coupon.title} · ${settlement.correctLegs}/3`,
    status: settlement.status,
    details: {
      parentCouponId: coupon.id,
      correctLegs: settlement.correctLegs,
      totalLegs: settlement.totalLegs,
      legResultsJson: JSON.stringify(settlement.legResults),
      bookmaker: priced ? coupon.details.bookmaker ?? null : null,
      odds,
      stake,
      profitLoss,
      potentialReturn,
    },
  };
}
