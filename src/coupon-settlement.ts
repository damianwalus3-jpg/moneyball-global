import type { TrackerRecord } from "./tracker-store";

export interface PaperCouponSettlement {
  couponId: string;
  status: "PAPER_HIT" | "PAPER_MISS";
  correctLegs: number;
  totalLegs: 3;
  legResults: Array<{ fixtureId: string; selection: "1" | "X" | "2"; actual: "1" | "X" | "2"; correct: boolean }>;
}
export function evaluatePaperCoupon(coupon: TrackerRecord, records: TrackerRecord[]): PaperCouponSettlement | null {
  if (coupon.kind !== "coupon" || coupon.status !== "PAPER_NO_ODDS" || typeof coupon.details.legsJson !== "string") return null;
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
    if (record.kind !== "result" || typeof record.details.fixtureId !== "string") continue;
    const actual = record.details.actual;
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
