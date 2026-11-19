import type { TrackerRecord } from "./tracker-store";
import { trackerFixtureIdentity } from "./prediction-record";
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
  let legs: Array<{ fixtureId: string; selection: CouponSelection; market?: "1X2" | "DOUBLE_CHANCE"; title?: string; competition?: string; home?: string; away?: string }>;
  try {
    const parsed: unknown = JSON.parse(coupon.details.legsJson);
    const validLegs = Array.isArray(parsed) && parsed.length === 3 && parsed.every((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const leg = value as Record<string, unknown>;
      if (typeof leg.fixtureId !== "string" || !["1","X","2","1X","X2","12"].includes(String(leg.selection))) return false;
      const inferred = ["1X","X2","12"].includes(String(leg.selection)) ? "DOUBLE_CHANCE" : "1X2";
      return leg.market === undefined || leg.market === inferred;
    });
    if (!validLegs) return null;
    legs = parsed as typeof legs;
  } catch { return null; }
  const rawToIdentity = new Map<string, string>();
  for (const record of records) {
    const rawId = record.details.fixtureId;
    if (typeof rawId !== "string" || !rawId) continue;
    const identity = trackerFixtureIdentity(record);
    if (identity) rawToIdentity.set(rawId, identity);
  }
  const legIdentity = (leg: typeof legs[number]): string => {
    const mapped = rawToIdentity.get(leg.fixtureId);
    if (mapped) return mapped;
    return trackerFixtureIdentity({
      id: "coupon-leg-" + leg.fixtureId, kind: "match",
      title: typeof leg.title === "string" ? leg.title : "",
      status: "LEG", createdAt: coupon.createdAt,
      details: {
        fixtureId: leg.fixtureId,
        date: typeof coupon.details.date === "string" ? coupon.details.date : null,
        fixtureDate: typeof coupon.details.date === "string" ? coupon.details.date : null,
        competition: typeof leg.competition === "string" ? leg.competition : null,
        home: typeof leg.home === "string" ? leg.home : null,
        away: typeof leg.away === "string" ? leg.away : null,
      },
    }) ?? leg.fixtureId;
  };
  const identities = legs.map(legIdentity);
  if (new Set(identities).size !== 3) return null;
  const resultMap = new Map<string, "1" | "X" | "2">();
  const orderedResults = records.filter(record => record.kind === "result" && typeof record.details.fixtureId === "string")
    .map((record, index) => ({ record, index, time: Date.parse(record.createdAt) }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.time) ? a.time : Number.NEGATIVE_INFINITY;
      const bTime = Number.isFinite(b.time) ? b.time : Number.NEGATIVE_INFINITY;
      return bTime - aTime || a.index - b.index;
    });
  for (const item of orderedResults) {
    const record = item.record;
    const rawId = record.details.fixtureId as string;
    const identity = rawToIdentity.get(rawId) ?? trackerFixtureIdentity(record) ?? rawId;
    const actual = record.details.actual;
    if (actual !== "1" && actual !== "X" && actual !== "2") continue;
    if (!resultMap.has(identity)) resultMap.set(identity, actual);
    if (!resultMap.has(rawId)) resultMap.set(rawId, actual);
  }
  const legResults = legs.flatMap((leg, index) => {
    const actual = resultMap.get(identities[index]) ?? resultMap.get(leg.fixtureId);
    if (!actual) return [];
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
