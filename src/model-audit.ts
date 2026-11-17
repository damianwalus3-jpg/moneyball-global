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
  for (const record of records) {
    if (record.kind !== "result" || typeof record.details.fixtureId !== "string") continue;
    const actual = record.details.actual;
    if (actual === "1" || actual === "X" || actual === "2") results.set(record.details.fixtureId, actual);
  }
  const predictions = records.filter(record => record.kind === "prediction" && typeof record.details.fixtureId === "string");
  const settled = predictions.flatMap(record => {
    const d = record.details;
    const actual = results.get(d.fixtureId as string);
    const p = [d.p1, d.px, d.p2];
    if (!actual || p.some(value => typeof value !== "number" || !Number.isFinite(value))) return [];
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
