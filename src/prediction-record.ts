import type { TrackerRecord } from "./tracker-store";
import { canonicalFixtureId } from "./free-fixtures";

function recordFixtureId(details: TrackerRecord["details"]): string | undefined {
  if (typeof details.fixtureDate === "string" && typeof details.home === "string" && typeof details.away === "string") {
    return canonicalFixtureId(details.fixtureDate, details.home, details.away, typeof details.competition === "string" ? details.competition : "");
  }
  return typeof details.fixtureId === "string" ? details.fixtureId : undefined;
}

/** Canonical analytical identity shared by match, prediction and result rows, even when provider IDs differ. */
export function trackerFixtureIdentity(row: Pick<TrackerRecord, "title" | "details">): string | undefined {
  const details = row.details;
  const date = typeof details.fixtureDate === "string" ? details.fixtureDate
    : typeof details.date === "string" ? details.date : undefined;
  let home = typeof details.home === "string" ? details.home.trim() : "";
  let away = typeof details.away === "string" ? details.away.trim() : "";
  if ((!home || !away) && typeof row.title === "string") {
    const matchup = row.title.split(" · ").pop() ?? row.title;
    const separator = matchup.indexOf(" vs ");
    if (separator > 0) {
      if (!home) home = matchup.slice(0, separator).trim();
      if (!away) away = matchup.slice(separator + 4).trim();
    }
  }
  if (date && home && away) {
    return canonicalFixtureId(date, home, away, typeof details.competition === "string" ? details.competition : "");
  }
  return typeof details.fixtureId === "string" ? details.fixtureId : undefined;
}
function hasValidProbabilities(details: TrackerRecord["details"], market: string): boolean {
  const values = market === "DOUBLE_CHANCE" ? [details.p1x, details.px2, details.p12] : [details.p1, details.px, details.p2];
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return false;
  const total = (values[0] as number) + (values[1] as number) + (values[2] as number);
  return Math.abs(total - (market === "DOUBLE_CHANCE" ? 2 : 1)) <= 0.0001;
}
/** Six-hour retry policy for a missing or invalid market record. */
export function shouldRetryPredictionAttempt(lastAttempt: unknown, now: number, intervalMs: number): boolean {
  return typeof lastAttempt !== "number" || !Number.isFinite(lastAttempt) || now - lastAttempt >= intervalMs;
}

/** Retry valid-probability rows when their evidence audit is still incomplete. */
export function shouldRetryPredictionWithEvidence(
  prior: TrackerRecord | undefined,
  market: string,
  lastAttempt: unknown,
  now: number,
  intervalMs: number,
): boolean {
  if (prior && prior.details.evidenceComplete === true && hasValidProbabilities(prior.details, market)) return false;
  return shouldRetryPredictionAttempt(lastAttempt, now, intervalMs);
}

export function shouldAppendPrediction(records: TrackerRecord[], fixtureId: string, model: string,
  nextProbabilitiesAvailable: boolean, nextMethod?: string, market = "1X2",
  nextEvidenceComplete?: boolean, nextEvidenceGaps?: string): boolean {
  const existing = records.filter(row => row.kind === "prediction" && recordFixtureId(row.details) === fixtureId
    && row.details.model === model && (typeof row.details.market === "string" ? row.details.market : "1X2") === market);
  const latestValid = existing.filter(row => hasValidProbabilities(row.details, market))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (latestValid) {
    const evidenceChanged = (typeof nextEvidenceComplete === "boolean" && latestValid.details.evidenceComplete !== nextEvidenceComplete)
      || (typeof nextEvidenceGaps === "string" && latestValid.details.evidenceGaps !== nextEvidenceGaps);
    if (evidenceChanged) return true;
    return latestValid.details.predictionMethod === "neutral-prior-poisson"
      && nextProbabilitiesAvailable && nextMethod !== "neutral-prior-poisson";
  }
  if (existing.length === 0) return true;
  return nextProbabilitiesAvailable;
}

/** True when a scanned fixture has no independent record for either market. */
/** Returns whether the newest record for a fixture/model/market has a mathematically valid probability vector. */
export function hasValidPredictionMarket(records: TrackerRecord[], fixtureId: string, market: string, model?: string): boolean {
  const rows = records.filter(row => row.kind === "prediction" && recordFixtureId(row.details) === fixtureId
    && (row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2") === market
    && (model === undefined || row.details.model === model))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (model !== undefined) return rows.length > 0 && hasValidProbabilities(rows[0].details, market);
  const latestByModel = new Map<string, TrackerRecord>();
  for (const row of rows) {
    const key = typeof row.details.model === "string" ? row.details.model : "legacy";
    if (!latestByModel.has(key)) latestByModel.set(key, row);
  }
  return [...latestByModel.values()].some(row => hasValidProbabilities(row.details, market));
}

export function hasMissingPredictionMarket(records: TrackerRecord[], fixtureId: string): boolean {
  const markets = new Set(records.filter(row => row.kind === "prediction" && recordFixtureId(row.details) === fixtureId)
    .map(row => row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2"));
  return !markets.has("1X2") || !markets.has("DOUBLE_CHANCE");
}

export interface HistoryProvenanceSide { source?: string; matches?: number; homeMatches?: number; awayMatches?: number; sourceUpdatedAt?: string; }
export interface HistoryProvenance { home?: HistoryProvenanceSide; away?: HistoryProvenanceSide; cutoffDateExclusive?: string; }
export function parseHistoryProvenance(value: unknown): HistoryProvenance | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const data = parsed as Record<string, unknown>;
    const side = (candidate: unknown): HistoryProvenanceSide | undefined => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
      const item = candidate as Record<string, unknown>, result: HistoryProvenanceSide = {};
      if (typeof item.source === "string") result.source = item.source;
      if (typeof item.sourceUpdatedAt === "string") result.sourceUpdatedAt = item.sourceUpdatedAt;
      for (const key of ["matches", "homeMatches", "awayMatches"] as const) {
        const n = item[key]; if (typeof n === "number" && Number.isInteger(n) && n >= 0) result[key] = n;
      }
      return result;
    };
    const result: HistoryProvenance = { home: side(data.home), away: side(data.away) };
    if (typeof data.cutoffDateExclusive === "string") result.cutoffDateExclusive = data.cutoffDateExclusive;
    return result.home || result.away || result.cutoffDateExclusive ? result : null;
  } catch { return null; }
}
export function describeHistoryProvenance(value: unknown): string {
  const data = parseHistoryProvenance(value);
  if (!data) return "Brak zapisanych metadanych źródeł historii.";
  const describe = (label: string, side?: HistoryProvenanceSide) => {
    if (!side) return label + ": brak danych";
    const sample = typeof side.matches === "number" ? side.matches : "—";
    const home = typeof side.homeMatches === "number" ? side.homeMatches : "—";
    const away = typeof side.awayMatches === "number" ? side.awayMatches : "—";
    return label + ": " + (side.source ?? "źródło nieznane") + "; wyniki: " + sample + "; u siebie: " + home + "; na wyjeździe: " + away
      + (side.sourceUpdatedAt ? ", aktualizacja: " + side.sourceUpdatedAt : "");
  };
  return [describe("Gospodarz", data.home), describe("Gość", data.away),
    data.cutoffDateExclusive ? "Dane wyłącznie sprzed: " + data.cutoffDateExclusive : ""].filter(Boolean).join(" | ");
}
