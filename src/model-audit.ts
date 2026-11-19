import { evaluatePredictions, type PredictionMetrics } from "./prediction-engine";
import type { TrackerRecord } from "./tracker-store";
import { trackerFixtureIdentity } from "./prediction-record";
export interface CalibrationBucket { label: string; count: number; averageConfidence: number; observedAccuracy: number; }
export interface BinaryMarketMetrics { count: number; brierScore: number; logLoss: number; accuracy: number; }
export interface ModelComparison {
  model: string; market: "1X2" | "DOUBLE_CHANCE"; count: number; sampleMatches: number;
  minimumSampleSize: number; sampleQualified: boolean;
  metrics: PredictionMetrics | BinaryMarketMetrics | null; expectedCalibrationError: number | null; buckets: CalibrationBucket[];
}
export interface ModelAudit {
  metrics: PredictionMetrics | null; doubleChance: BinaryMarketMetrics | null; buckets: CalibrationBucket[];
  unmatchedPredictions: number; settledPredictions: number; modelComparisons: ModelComparison[]; minimumSampleSize: number;
}
function calibrationBuckets(rows: Array<{ confidence: number; correct: boolean }>): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < 5; i++) {
    const lower = i * 0.2, upper = lower + 0.2;
    const sample = rows.filter(row => row.confidence >= lower && (i === 4 ? row.confidence <= upper : row.confidence < upper));
    if (sample.length) buckets.push({ label: Math.round(lower * 100) + "–" + Math.round(upper * 100) + "%",
      count: sample.length, averageConfidence: sample.reduce((s, r) => s + r.confidence, 0) / sample.length,
      observedAccuracy: sample.filter(r => r.correct).length / sample.length });
  }
  return buckets;
}
function ece(buckets: CalibrationBucket[], count: number): number | null {
  return count ? buckets.reduce((sum, b) => sum + b.count / count * Math.abs(b.averageConfidence - b.observedAccuracy), 0) : null;
}
function binaryMetrics(rows: Array<{ probability: number; actual: boolean }>): BinaryMarketMetrics | null {
  if (!rows.length) return null;
  return { count: rows.length, brierScore: rows.reduce((s, r) => s + (r.probability - (r.actual ? 1 : 0)) ** 2, 0) / rows.length,
    logLoss: rows.reduce((s, r) => s - Math.log(Math.max(r.actual ? r.probability : 1 - r.probability, 1e-15)), 0) / rows.length,
    accuracy: rows.filter(r => (r.probability >= 0.5) === r.actual).length / rows.length };
}
function valid1x2(d: TrackerRecord["details"]): boolean {
  const p = [d.p1, d.px, d.p2];
  return p.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)
    && Math.abs((d.p1 as number) + (d.px as number) + (d.p2 as number) - 1) <= 0.0001;
}
function validDC(d: TrackerRecord["details"]): boolean {
  const values = [d.p1x, d.px2, d.p12];
  return values.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)
    && Math.abs((values[0] as number) + (values[1] as number) + (values[2] as number) - 2) <= 0.0001;
}
export function auditTrackerPredictions(records: TrackerRecord[], minimumSampleSize = 30): ModelAudit {
  // Resolve provider-specific IDs to the same Brussels-date/team identity used by
  // fixture scanning, market coverage and coupon generation. Historical rows remain untouched.
  const rawToCanonical = new Map<string, string>();
  for (const row of records) {
    const rawId = typeof row.details.fixtureId === "string" ? row.details.fixtureId : "";
    if (!rawId) continue;
    const identity = trackerFixtureIdentity(row);
    if (identity?.startsWith("canonical|")) rawToCanonical.set(rawId, identity);
  }
  const fixtureIdentity = (row: TrackerRecord): string | null => {
    const direct = trackerFixtureIdentity(row);
    if (direct?.startsWith("canonical|")) return direct;
    const rawId = typeof row.details.fixtureId === "string" ? row.details.fixtureId : "";
    return (rawId ? rawToCanonical.get(rawId) : undefined) ?? direct ?? (rawId || null);
  };

  const results = new Map<string, "1" | "X" | "2">();
  const orderedResults = records.filter(r => r.kind === "result" && typeof r.details.fixtureId === "string"
    && ["1", "X", "2"].includes(String(r.details.actual)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  for (const r of orderedResults) {
    const identity = fixtureIdentity(r);
    if (identity && !results.has(identity)) results.set(identity, r.details.actual as "1" | "X" | "2");
  }
  const ordered = records.filter(r => r.kind === "prediction" && typeof r.details.fixtureId === "string")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  const latest = new Map<string, TrackerRecord>();
  const latestIdentity = new Map<string, string>();
  for (const r of ordered) {
    const d = r.details, identity = fixtureIdentity(r);
    if (!identity) continue;
    const model = typeof d.model === "string" ? d.model : "legacy";
    const market = d.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
    const key = [identity, model, market].join("|");
    if (!latest.has(key)) { latest.set(key, r); latestIdentity.set(key, identity); }
  }
  const grouped1 = new Map<string, Array<{ fixtureId: string; probabilities: { home: number; draw: number; away: number }; actual: "1" | "X" | "2" }>>();
  const groupedDC = new Map<string, Array<{ fixtureId: string; probability: number; actual: boolean }>>();
  for (const [key, r] of latest) {
    const d = r.details, identity = latestIdentity.get(key), actual = identity ? results.get(identity) : undefined;
    const model = typeof d.model === "string" ? d.model : "legacy";
    if (!identity || !actual) continue;
    if (d.market === "DOUBLE_CHANCE") {
      // Only a separate, valid DOUBLE_CHANCE Tracker row is an independent DC prediction.
      // Embedded legacy dc1x/dcx2/dc12 values on a 1X2 row never fill a missing market.
      if (!validDC(d)) continue;
      const rows = groupedDC.get(model) ?? [];
      rows.push({ fixtureId: identity, probability: d.p1x as number, actual: actual !== "2" },
        { fixtureId: identity, probability: d.px2 as number, actual: actual !== "1" },
        { fixtureId: identity, probability: d.p12 as number, actual: actual !== "X" });
      groupedDC.set(model, rows);
    } else if (valid1x2(d)) {
      const rows = grouped1.get(model) ?? [];
      rows.push({ fixtureId: identity, probabilities: { home: d.p1 as number, draw: d.px as number, away: d.p2 as number }, actual });
      grouped1.set(model, rows);
    }
  }
  const comparisons: ModelComparison[] = [];
  for (const [model, rows] of grouped1) {
    const metrics = evaluatePredictions(rows);
    const buckets = calibrationBuckets(rows.map(row => {
      const p = [row.probabilities.home, row.probabilities.draw, row.probabilities.away], max = Math.max(...p), index = p.indexOf(max);
      return { confidence: max, correct: (index === 0 ? "1" : index === 1 ? "X" : "2") === row.actual };
    }));
    const sampleMatches = new Set(rows.map(row => row.fixtureId)).size;
    comparisons.push({ model, market: "1X2", count: rows.length, sampleMatches, minimumSampleSize,
      sampleQualified: sampleMatches >= minimumSampleSize, metrics, expectedCalibrationError: ece(buckets, rows.length), buckets });
  }
  for (const [model, rows] of groupedDC) {
    const metrics = binaryMetrics(rows);
    const buckets = calibrationBuckets(rows.map(row => ({ confidence: row.probability, correct: (row.probability >= 0.5) === row.actual })));
    const sampleMatches = new Set(rows.map(row => row.fixtureId)).size;
    comparisons.push({ model, market: "DOUBLE_CHANCE", count: rows.length, sampleMatches, minimumSampleSize,
      sampleQualified: sampleMatches >= minimumSampleSize, metrics, expectedCalibrationError: ece(buckets, rows.length), buckets });
  }
  comparisons.sort((a, b) => a.market.localeCompare(b.market) || a.model.localeCompare(b.model));
  const primary = comparisons.find(c => c.market === "1X2"), primaryDC = comparisons.find(c => c.market === "DOUBLE_CHANCE");
  const all1x2 = [...latest.entries()].filter(([, row]) => row.details.market !== "DOUBLE_CHANCE");
  const fixtureIds = new Set(all1x2.map(([key]) => latestIdentity.get(key)).filter((id): id is string => !!id));
  const settledIds = new Set([...grouped1.values()].flatMap(rows => rows.map(row => row.fixtureId)));
  return { metrics: primary?.metrics as PredictionMetrics | null ?? null,
    doubleChance: primaryDC?.metrics as BinaryMarketMetrics | null ?? null, buckets: primary?.buckets ?? [],
    unmatchedPredictions: Math.max(0, fixtureIds.size - settledIds.size), settledPredictions: settledIds.size,
    modelComparisons: comparisons, minimumSampleSize };
}