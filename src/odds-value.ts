import type { TrackerRecord } from "./tracker-store";

export interface OddsValuation {
  fixtureId: string;
  bookmaker: string;
  capturedAt: string;
  selection: "1" | "X" | "2";
  decimalOdds: number;
  modelProbability: number;
  marketProbabilityNoVig: number;
  expectedValue: number;
  fresh: true;
}

const SELECTION_KEYS = {
  "1": { odds: "odds1", probability: "p1" },
  X: { odds: "oddsX", probability: "px" },
  "2": { odds: "odds2", probability: "p2" },
} as const;

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validDecimalOdds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 1 && value <= 1000;
}

/**
 * Returns the latest complete, fresh 1X2 snapshot for one fixture and one
 * explicitly selected bookmaker. Incomplete, future-dated and stale rows fail closed.
 */
export function valueSelectionFromOdds(
  records: TrackerRecord[],
  fixtureId: string,
  selection: "1" | "X" | "2",
  bookmaker: string,
  modelProbabilities: { p1: number; px: number; p2: number },
  now = new Date().toISOString(),
  maxAgeMinutes = 15,
): OddsValuation | null {
  if (!fixtureId || !bookmaker.trim() || !Number.isFinite(Date.parse(now)) || maxAgeMinutes < 0) return null;
  const probabilities = [modelProbabilities.p1, modelProbabilities.px, modelProbabilities.p2];
  if (probabilities.some(value => !validProbability(value)) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 0.0001) return null;

  const eligible = records.filter(row => {
    const d = row.details;
    if (row.kind !== "odds" || d.fixtureId !== fixtureId || d.bookmaker !== bookmaker
      || d.market !== "1X2" || d.complete1X2 !== true || row.status !== "COMPLETE_1X2") return false;
    const captured = typeof d.capturedAt === "string" ? Date.parse(d.capturedAt) : NaN;
    const current = Date.parse(now);
    return Number.isFinite(captured) && captured <= current && current - captured <= maxAgeMinutes * 60_000
      && validDecimalOdds(d.odds1) && validDecimalOdds(d.oddsX) && validDecimalOdds(d.odds2);
  }).sort((a, b) => Date.parse(String(b.details.capturedAt)) - Date.parse(String(a.details.capturedAt)));

  const snapshot = eligible[0];
  if (!snapshot) return null;
  const d = snapshot.details;
  const odds1 = d.odds1 as number;
  const oddsX = d.oddsX as number;
  const odds2 = d.odds2 as number;
  const raw = [1 / odds1, 1 / oddsX, 1 / odds2];
  const overround = raw.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(overround) || overround <= 0) return null;
  const market = raw.map(value => value / overround);
  const key = SELECTION_KEYS[selection];
  const decimalOdds = d[key.odds] as number;
  const modelProbability = modelProbabilities[key.probability];
  const marketProbabilityNoVig = market[selection === "1" ? 0 : selection === "X" ? 1 : 2];
  return {
    fixtureId,
    bookmaker,
    capturedAt: String(d.capturedAt),
    selection,
    decimalOdds,
    modelProbability,
    marketProbabilityNoVig,
    expectedValue: modelProbability * decimalOdds - 1,
    fresh: true,
  };
}

export function listOddsBookmakers(records: TrackerRecord[], fixtureIds: string[], now = new Date().toISOString(), maxAgeMinutes = 15): string[] {
  const ids = new Set(fixtureIds);
  const current = Date.parse(now);
  if (!Number.isFinite(current)) return [];
  return [...new Set(records.flatMap(row => {
    const d = row.details;
    if (row.kind !== "odds" || row.status !== "COMPLETE_1X2" || d.complete1X2 !== true
      || typeof d.fixtureId !== "string" || !ids.has(d.fixtureId)
      || typeof d.bookmaker !== "string" || !d.bookmaker.trim()
      || !validDecimalOdds(d.odds1) || !validDecimalOdds(d.oddsX) || !validDecimalOdds(d.odds2)
      || typeof d.capturedAt !== "string") return [];
    const captured = Date.parse(d.capturedAt);
    return Number.isFinite(captured) && captured <= current && current - captured <= maxAgeMinutes * 60_000 ? [d.bookmaker] : [];
  }))].sort((a, b) => a.localeCompare(b));
}
