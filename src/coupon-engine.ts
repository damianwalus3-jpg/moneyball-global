import type { TrackerRecord } from "./tracker-store";

export interface CouponLegCandidate {
  fixtureId: string;
  title: string;
  competition: string;
  selection: "1" | "X" | "2";
  probability: number;
  source: string;
  model: string;
}
export interface ThreeLegCandidate {
  legs: [CouponLegCandidate, CouponLegCandidate, CouponLegCandidate];
  combinedProbability: number;
  averageProbability: number;
  date: string;
  oddsAvailable: false;
}

function candidateFromRecord(record: TrackerRecord, date: string): CouponLegCandidate | null {
  const d = record.details;
  if (record.kind !== "prediction" || record.status !== "KANDYDAT") return null;
  if (d.fixtureDate !== date || d.strongCandidate !== true) return null;
  if (typeof d.fixtureId !== "string" || typeof d.selection !== "string" || !["1","X","2"].includes(d.selection)) return null;
  const probabilities = [d.p1, d.px, d.p2];
  if (probabilities.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return null;
  const [p1, px, p2] = probabilities as [number, number, number];
  if (Math.abs(p1 + px + p2 - 1) > 0.0001) return null;
  const ranked = [{ selection: "1", probability: p1 }, { selection: "X", probability: px }, { selection: "2", probability: p2 }]
    .sort((a, b) => b.probability - a.probability);
  if (d.selection !== ranked[0].selection) return null;
  const probability = ranked[0].probability;
  if (probability < 0.75) return null;
  return {
    fixtureId: d.fixtureId,
    title: record.title,
    competition: typeof d.competition === "string" ? d.competition : "Rozgrywki nieznane",
    selection: d.selection as "1" | "X" | "2",
    probability,
    source: typeof d.source === "string" ? d.source : "unknown",
    model: typeof d.model === "string" ? d.model : "unknown",
  };
}

export function buildThreeLegCandidates(records: TrackerRecord[], date: string, limit = 30): ThreeLegCandidate[] {
  // Resolve the latest prediction per fixture BEFORE eligibility filtering.
  // Otherwise an older strong candidate could survive a newer rejected/weak row.
  const newestPredictionByFixture = new Map<string, TrackerRecord>();
  const createdAtByFixture = new Map<string, number>();
  for (const record of records) {
    if (record.kind !== "prediction" || record.details.fixtureDate !== date
      || typeof record.details.fixtureId !== "string" || !record.details.fixtureId) continue;
    const createdAt = Date.parse(record.createdAt);
    if (!Number.isFinite(createdAt)) continue;
    const fixtureId = record.details.fixtureId;
    const previous = createdAtByFixture.get(fixtureId);
    if (previous === undefined || createdAt > previous) {
      newestPredictionByFixture.set(fixtureId, record);
      createdAtByFixture.set(fixtureId, createdAt);
    }
  }
  const pool = [...newestPredictionByFixture.values()]
    .map(record => candidateFromRecord(record, date))
    .filter((candidate): candidate is CouponLegCandidate => candidate !== null)
    .sort((a, b) => b.probability - a.probability);
  const output: ThreeLegCandidate[] = [];
  for (let i = 0; i < pool.length - 2; i++) {
    for (let j = i + 1; j < pool.length - 1; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const legs = [pool[i], pool[j], pool[k]] as ThreeLegCandidate["legs"];
        const combinedProbability = legs.reduce((product, leg) => product * leg.probability, 1);
        output.push({
          legs,
          combinedProbability,
          averageProbability: legs.reduce((sum, leg) => sum + leg.probability, 0) / 3,
          date,
          oddsAvailable: false,
        });
      }
    }
  }
  return output.sort((a, b) => b.combinedProbability - a.combinedProbability).slice(0, Math.max(0, limit));
}
