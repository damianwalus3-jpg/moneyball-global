import type { TrackerRecord } from "./tracker-store";
import { hasKickoffPassed } from "./safest-pick";
export interface CouponLegCandidate {
  fixtureId: string; title: string; competition: string;
  selection: "1" | "X" | "2" | "1X" | "X2" | "12";
  market: "1X2" | "DOUBLE_CHANCE"; probability: number; source: string; model: string;
}
export interface ThreeLegCandidate {
  legs: [CouponLegCandidate, CouponLegCandidate, CouponLegCandidate];
  combinedProbability: number; averageProbability: number; date: string; oddsAvailable: false;
}
function candidateFromRecord(record: TrackerRecord, date: string): CouponLegCandidate | null {
  const d = record.details;
  if (record.kind !== "prediction" || record.status !== "KANDYDAT" || d.fixtureDate !== date || typeof d.fixtureId !== "string" || !d.fixtureId) return null;
  if (d.couponEligible !== true || d.evidenceComplete !== true) return null;
  if (typeof d.fixtureTime === "string" && hasKickoffPassed(date, d.fixtureTime)) return null;
  const base = { fixtureId: d.fixtureId, title: record.title,
    competition: typeof d.competition === "string" ? d.competition : "Rozgrywki nieznane",
    source: typeof d.source === "string" ? d.source : "unknown", model: typeof d.model === "string" ? d.model : "unknown" };
  if (d.market === "DOUBLE_CHANCE") {
    const selection = d.selection, probability = d.probability;
    if (d.strongDoubleChance !== true || !["1X", "X2", "12"].includes(String(selection))
      || typeof probability !== "number" || !Number.isFinite(probability) || probability < 0.75 || probability > 1) return null;
    const values = [d.p1x, d.px2, d.p12];
    if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
      || Math.abs((values[0] as number) + (values[1] as number) + (values[2] as number) - 2) > 0.0001) return null;
    const ranked = [{ selection: "1X", probability: d.p1x as number }, { selection: "X2", probability: d.px2 as number }, { selection: "12", probability: d.p12 as number }]
      .sort((a, b) => b.probability - a.probability);
    const selected = selection === "1X" ? d.p1x : selection === "X2" ? d.px2 : d.p12;
    if (selection !== ranked[0].selection || typeof selected !== "number" || Math.abs(selected - probability) > 0.0001) return null;
    return { ...base, selection: selection as "1X" | "X2" | "12", market: "DOUBLE_CHANCE", probability };
  }
  if (d.strongCandidate !== true || typeof d.selection !== "string" || !["1", "X", "2"].includes(d.selection)) return null;
  const values = [d.p1, d.px, d.p2];
  if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)) return null;
  const [p1, px, p2] = values as [number, number, number];
  if (Math.abs(p1 + px + p2 - 1) > 0.0001) return null;
  const ranked = [{ selection: "1", probability: p1 }, { selection: "X", probability: px }, { selection: "2", probability: p2 }].sort((a, b) => b.probability - a.probability);
  if (d.selection !== ranked[0].selection || ranked[0].probability < 0.75) return null;
  return { ...base, selection: d.selection as "1" | "X" | "2", market: "1X2", probability: ranked[0].probability };
}
export function buildThreeLegCandidates(records: TrackerRecord[], date: string, limit = 30): ThreeLegCandidate[] {
  const newest = new Map<string, TrackerRecord>(), timestamps = new Map<string, number>();
  for (const record of records) {
    const d = record.details;
    if (record.kind !== "prediction" || d.fixtureDate !== date || typeof d.fixtureId !== "string" || !d.fixtureId) continue;
    const key = [d.fixtureId, typeof d.model === "string" ? d.model : "legacy", d.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2"].join("|");
    const time = Date.parse(record.createdAt);
    if (!Number.isFinite(time)) continue;
    if (!timestamps.has(key) || time > timestamps.get(key)!) { timestamps.set(key, time); newest.set(key, record); }
  }
  const bestByFixture = new Map<string, CouponLegCandidate>();
  for (const record of newest.values()) {
    const candidate = candidateFromRecord(record, date); if (!candidate) continue;
    const previous = bestByFixture.get(candidate.fixtureId);
    if (!previous || candidate.probability > previous.probability) bestByFixture.set(candidate.fixtureId, candidate);
  }
  const pool = [...bestByFixture.values()].sort((a, b) => b.probability - a.probability);
  const output: ThreeLegCandidate[] = [];
  for (let i = 0; i < pool.length - 2; i++) for (let j = i + 1; j < pool.length - 1; j++) for (let k = j + 1; k < pool.length; k++) {
    const legs = [pool[i], pool[j], pool[k]] as ThreeLegCandidate["legs"];
    if (new Set(legs.map(leg => leg.fixtureId)).size !== 3) continue;
    const combinedProbability = legs.reduce((product, leg) => product * leg.probability, 1);
    output.push({ legs, combinedProbability, averageProbability: legs.reduce((sum, leg) => sum + leg.probability, 0) / 3, date, oddsAvailable: false });
  }
  return output.sort((a, b) => b.combinedProbability - a.combinedProbability).slice(0, Math.max(0, limit));
}
