import type { TrackerRecord } from "./tracker-store";

export type OddsMarket = "1X2" | "DOUBLE_CHANCE";
export type OddsSelection = "1" | "X" | "2" | "1X" | "X2" | "12";
export interface OddsValuation {
  fixtureId: string;
  bookmaker: string;
  capturedAt: string;
  market: OddsMarket;
  selection: OddsSelection;
  decimalOdds: number;
  modelProbability: number;
  marketProbabilityNoVig: number | null;
  expectedValue: number;
  fresh: true;
}

const SELECTION_KEYS = {
  "1": { odds: "odds1", probability: "p1" },
  X: { odds: "oddsX", probability: "px" },
  "2": { odds: "odds2", probability: "p2" },
} as const;
const DOUBLE_CHANCE_KEYS = {
  "1X": { odds: "odds1x", probability: "p1x" },
  X2: { odds: "oddsX2", probability: "px2" },
  "12": { odds: "odds12", probability: "p12" },
} as const;

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function validDecimalOdds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 1 && value <= 1000;
}
function isFresh(capturedAt: unknown, now: number, maxAgeMinutes: number): capturedAt is string {
  if (typeof capturedAt !== "string") return false;
  const captured = Date.parse(capturedAt);
  return Number.isFinite(captured) && captured <= now && now - captured <= maxAgeMinutes * 60_000;
}
function freshCompleteSnapshot(
  records: TrackerRecord[], fixtureId: string, bookmaker: string, market: OddsMarket,
  now: number, maxAgeMinutes: number,
): TrackerRecord | undefined {
  const eligible = records.filter(row => {
    const d = row.details;
    if (row.kind !== "odds" || d.fixtureId !== fixtureId || d.bookmaker !== bookmaker
      || (d.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2") !== market) return false;
    if (!isFresh(d.capturedAt, now, maxAgeMinutes)) return false;
    if (market === "1X2") {
      return row.status === "COMPLETE_1X2" && (d.complete1X2 === true || d.complete1X2 === undefined)
        && validDecimalOdds(d.odds1) && validDecimalOdds(d.oddsX) && validDecimalOdds(d.odds2);
    }
    return row.status === "COMPLETE_DOUBLE_CHANCE" && d.completeDoubleChance === true
      && validDecimalOdds(d.odds1x) && validDecimalOdds(d.oddsX2) && validDecimalOdds(d.odds12);
  }).sort((a, b) => Date.parse(String(b.details.capturedAt)) - Date.parse(String(a.details.capturedAt)));
  return eligible[0];
}

/** Values a 1X2 selection using a complete fresh snapshot and removes the three-way bookmaker margin. */
export function valueSelectionFromOdds(
  records: TrackerRecord[],
  fixtureId: string,
  selection: "1" | "X" | "2",
  bookmaker: string,
  modelProbabilities: { p1: number; px: number; p2: number },
  now = new Date().toISOString(),
  maxAgeMinutes = 60,
): OddsValuation | null {
  const current = Date.parse(now);
  if (!fixtureId || !bookmaker.trim() || !Number.isFinite(current) || maxAgeMinutes < 0) return null;
  const probabilities = [modelProbabilities.p1, modelProbabilities.px, modelProbabilities.p2];
  if (probabilities.some(value => !validProbability(value)) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 0.0001) return null;
  const snapshot = freshCompleteSnapshot(records, fixtureId, bookmaker, "1X2", current, maxAgeMinutes);
  if (!snapshot) return null;
  const d = snapshot.details;
  const odds = [d.odds1 as number, d.oddsX as number, d.odds2 as number];
  const raw = odds.map(value => 1 / value);
  const overround = raw.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(overround) || overround <= 0) return null;
  const market = raw.map(value => value / overround);
  const key = SELECTION_KEYS[selection];
  const decimalOdds = d[key.odds] as number;
  const modelProbability = modelProbabilities[key.probability];
  const marketProbabilityNoVig = market[selection === "1" ? 0 : selection === "X" ? 1 : 2];
  return {
    fixtureId, bookmaker, capturedAt: String(d.capturedAt), market: "1X2", selection,
    decimalOdds, modelProbability, marketProbabilityNoVig,
    expectedValue: modelProbability * decimalOdds - 1, fresh: true,
  };
}

/**
 * Values direct Double Chance prices. 1X, X2 and 12 overlap, so they are not
 * mutually exclusive outcomes: do not normalize their implied probabilities
 * as if they were a 1X2 book. EV uses the model's direct DC probability.
 */
export function valueDoubleChanceSelectionFromOdds(
  records: TrackerRecord[],
  fixtureId: string,
  selection: "1X" | "X2" | "12",
  bookmaker: string,
  modelProbabilities: { p1x: number; px2: number; p12: number },
  now = new Date().toISOString(),
  maxAgeMinutes = 60,
): OddsValuation | null {
  const current = Date.parse(now);
  if (!fixtureId || !bookmaker.trim() || !Number.isFinite(current) || maxAgeMinutes < 0) return null;
  const probabilities = [modelProbabilities.p1x, modelProbabilities.px2, modelProbabilities.p12];
  if (probabilities.some(value => !validProbability(value)) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 2) > 0.0001) return null;
  const snapshot = freshCompleteSnapshot(records, fixtureId, bookmaker, "DOUBLE_CHANCE", current, maxAgeMinutes);
  if (!snapshot) return null;
  const d = snapshot.details;
  const key = DOUBLE_CHANCE_KEYS[selection];
  const decimalOdds = d[key.odds] as number;
  const modelProbability = modelProbabilities[key.probability];
  return {
    fixtureId, bookmaker, capturedAt: String(d.capturedAt), market: "DOUBLE_CHANCE", selection,
    decimalOdds, modelProbability, marketProbabilityNoVig: null,
    expectedValue: modelProbability * decimalOdds - 1, fresh: true,
  };
}

function validCompleteSnapshotForList(row: TrackerRecord, fixtureIds: Set<string>, now: number, maxAgeMinutes: number): boolean {
  const d = row.details;
  if (row.kind !== "odds" || typeof d.fixtureId !== "string" || !fixtureIds.has(d.fixtureId)
    || typeof d.bookmaker !== "string" || !d.bookmaker.trim() || !isFresh(d.capturedAt, now, maxAgeMinutes)) return false;
  if (d.market !== "DOUBLE_CHANCE") {
    return row.status === "COMPLETE_1X2" && (d.complete1X2 === true || d.complete1X2 === undefined)
      && validDecimalOdds(d.odds1) && validDecimalOdds(d.oddsX) && validDecimalOdds(d.odds2);
  }
  if (d.market === "DOUBLE_CHANCE") {
    return row.status === "COMPLETE_DOUBLE_CHANCE" && d.completeDoubleChance === true
      && validDecimalOdds(d.odds1x) && validDecimalOdds(d.oddsX2) && validDecimalOdds(d.odds12);
  }
  return false;
}

export function listOddsBookmakers(records: TrackerRecord[], fixtureIds: string[], now = new Date().toISOString(), maxAgeMinutes = 60): string[] {
  const ids = new Set(fixtureIds);
  const current = Date.parse(now);
  if (!Number.isFinite(current)) return [];
  return [...new Set(records.filter(row => validCompleteSnapshotForList(row, ids, current, maxAgeMinutes))
    .map(row => String(row.details.bookmaker)))].sort((a, b) => a.localeCompare(b));
}

/** Returns fresh, complete 1X2 and direct Double Chance snapshots; stale/future quotes fail closed. */
export function listFreshOddsSnapshots(
  records: TrackerRecord[],
  fixtureId: string,
  now = new Date().toISOString(),
  maxAgeMinutes = 60,
): TrackerRecord[] {
  const current = Date.parse(now);
  if (!fixtureId || !Number.isFinite(current) || maxAgeMinutes < 0) return [];
  return records.filter(row => validCompleteSnapshotForList(row, new Set([fixtureId]), current, maxAgeMinutes))
    .sort((a, b) => Date.parse(String(b.details.capturedAt)) - Date.parse(String(a.details.capturedAt)));
}

/**
 * One automatic StrikerAPI daily snapshot is allowed per fixture-scan date.
 * A failed/empty attempt is still recorded by the caller to protect the free
 * monthly credit allowance from repeated refreshes or reloads.
 */
export function shouldAutoFetchDailyOdds(input: {
  fixtureDate: string;
  tokenSaved: boolean;
  providerReady: boolean;
  lastSuccessfulDate: string;
  lastAttemptedDate: string;
}): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fixtureDate)) return false;
  const year = Number(input.fixtureDate.slice(0, 4));
  const month = Number(input.fixtureDate.slice(5, 7));
  const day = Number(input.fixtureDate.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  return input.tokenSaved && input.providerReady && input.lastSuccessfulDate !== input.fixtureDate && input.lastAttemptedDate !== input.fixtureDate;
}
