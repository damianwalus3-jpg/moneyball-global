import type { TrackerRecord } from "./tracker-store";

function hasValidProbabilities(details: TrackerRecord["details"]): boolean {
  const values = [details.p1, details.px, details.p2];
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return false;
  return Math.abs((values[0] as number) + (values[1] as number) + (values[2] as number) - 1) <= 0.0001;
}

/**
 * Keeps failed form lookups from being duplicated on every scan, but allows a
 * later successful analysis to supersede an earlier placeholder prediction.
 */
export function shouldAppendPrediction(
  records: TrackerRecord[],
  fixtureId: string,
  model: string,
  nextProbabilitiesAvailable: boolean,
): boolean {
  const existing = records.filter(row => row.kind === "prediction"
    && row.details.fixtureId === fixtureId && row.details.model === model);
  if (existing.some(row => hasValidProbabilities(row.details))) return false;
  if (existing.length === 0) return true;
  return nextProbabilitiesAvailable;
}


export interface HistoryProvenanceSide {
  source?: string;
  matches?: number;
  homeMatches?: number;
  awayMatches?: number;
  sourceUpdatedAt?: string;
}
export interface HistoryProvenance {
  home?: HistoryProvenanceSide;
  away?: HistoryProvenanceSide;
  cutoffDateExclusive?: string;
}

/** Safely decodes additive provenance metadata; legacy Tracker rows remain valid. */
export function parseHistoryProvenance(value: unknown): HistoryProvenance | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const data = parsed as Record<string, unknown>;
    const side = (candidate: unknown): HistoryProvenanceSide | undefined => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
      const item = candidate as Record<string, unknown>;
      const result: HistoryProvenanceSide = {};
      if (typeof item.source === "string") result.source = item.source;
      if (typeof item.sourceUpdatedAt === "string") result.sourceUpdatedAt = item.sourceUpdatedAt;
      for (const key of ["matches", "homeMatches", "awayMatches"] as const) {
        const n = item[key];
        if (typeof n === "number" && Number.isInteger(n) && n >= 0) result[key] = n;
      }
      return result;
    };
    const result: HistoryProvenance = {
      home: side(data.home),
      away: side(data.away),
    };
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
    const updated = side.sourceUpdatedAt ? ", aktualizacja: " + side.sourceUpdatedAt : "";
    return label + ": " + (side.source ?? "źródło nieznane") + "; wyniki: " + sample + "; u siebie: " + home + "; na wyjeździe: " + away + updated;
  };
  return [describe("Gospodarz", data.home), describe("Gość", data.away),
    data.cutoffDateExclusive ? "Dane wyłącznie sprzed: " + data.cutoffDateExclusive : ""].filter(Boolean).join(" | ");
}
