import { evaluatePredictions, type PredictionMetrics } from "./prediction-engine";
import type { TrackerRecord } from "./tracker-store";

export interface CalibrationBucket {
  label: string;
  count: number;
  averageConfidence: number;
  observedAccuracy: number;
}
export interface ModelAudit {
  metrics: PredictionMetrics | null;
  buckets: CalibrationBucket[];
  unmatchedPredictions: number;
  settledPredictions: number;
}

export function auditTrackerPredictions(records: TrackerRecord[]): ModelAudit {
  const results = new Map<string, "1" | "X" | "2">();
  // Tracker records are newest-first. Keep the newest valid result if a
  // fixture has duplicate/legacy settlement rows instead of letting an older
  // row silently overwrite it during iteration.
  for (const record of records) {
    if (record.kind !== "result" || typeof record.details.fixtureId !== "string" || results.has(record.details.fixtureId)) continue;
    const actual = record.details.actual;
    if (actual === "1" || actual === "X" || actual === "2") results.set(record.details.fixtureId, actual);
  }
  const predictionByFixture = new Map<string, TrackerRecord>();
  for (const record of records) {
    if (record.kind !== "prediction" || typeof record.details.fixtureId !== "string" || predictionByFixture.has(record.details.fixtureId)) continue;
    // Tracker is newest-first: one canonical prediction per fixture prevents duplicate rows from overweighting metrics.
    predictionByFixture.set(record.details.fixtureId, record);
  }
  const predictions = [...predictionByFixture.values()];
  const settled = predictions.flatMap(record => {
    const d = record.details;
    const actual = results.get(d.fixtureId as string);
    const p = [d.p1, d.px, d.p2];
    if (!actual || p.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return [];
    const sum = (d.p1 as number) + (d.px as number) + (d.p2 as number);
    if (Math.abs(sum - 1) > 0.0001) return [];
    return [{
      probabilities: { home: d.p1 as number, draw: d.px as number, away: d.p2 as number },
      actual,
    }];
  });
  const metrics = evaluatePredictions(settled);
  const buckets: CalibrationBucket[] = [];
  for (let index = 0; index < 5; index++) {
    const lower = index * 0.2;
    const upper = lower + 0.2;
    const rows = settled.filter(row => {
      const confidence = Math.max(row.probabilities.home, row.probabilities.draw, row.probabilities.away);
      return confidence >= lower && (index === 4 ? confidence <= upper : confidence < upper);
    });
    if (!rows.length) continue;
    const averageConfidence = rows.reduce((sum, row) => sum + Math.max(row.probabilities.home, row.probabilities.draw, row.probabilities.away), 0) / rows.length;
    const observedAccuracy = rows.filter(row => {
      const predicted = row.probabilities.home >= row.probabilities.draw && row.probabilities.home >= row.probabilities.away ? "1"
        : row.probabilities.draw >= row.probabilities.away ? "X" : "2";
      return predicted === row.actual;
    }).length / rows.length;
    buckets.push({ label: `${Math.round(lower * 100)}–${Math.round(upper * 100)}%`, count: rows.length, averageConfidence, observedAccuracy });
  }
  return {
    metrics,
    buckets,
    unmatchedPredictions: predictions.length - settled.length,
    settledPredictions: settled.length,
  };
}
