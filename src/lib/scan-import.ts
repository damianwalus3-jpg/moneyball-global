import { CANDIDATE_MIN_PROBABILITY, isValidPick } from "./domain";
import { brusselsInputToISO } from "./time";
import type { Pick, PredictionType, SelectionStatus } from "./types";

export interface ParsedMatch {
  key: string;
  kickoff_at: string;
  league: string;
  country: string | null;
  home_team: string;
  away_team: string;
}
export interface ParsedPrediction {
  matchKey: string;
  prediction_type: PredictionType;
  pick: Pick;
  probability: number;
  odds: number | null;
  confidence: string | null;
  selection_status: SelectionStatus;
  rejection_reason: string | null;
}
export interface ParsedScan {
  matches: ParsedMatch[];
  predictions: ParsedPrediction[];
  errors: { row: number; message: string }[];
}

const ALIASES: Record<string, string[]> = {
  kickoff: ["kickoff", "kickoff_at", "data", "date", "datetime", "termin"],
  league: ["league", "liga", "competition"],
  country: ["country", "kraj"],
  home: ["home_team", "home", "gospodarze", "gospodarz"],
  away: ["away_team", "away", "goscie", "goście", "gosc"],
  type: ["prediction_type", "type", "typ", "rynek", "market"],
  pick: ["pick", "wybor", "wybór", "selection"],
  probability: ["probability", "prob", "prawdopodobienstwo", "prawdopodobieństwo", "p"],
  odds: ["odds", "kurs"],
  confidence: ["confidence", "pewnosc", "pewność"],
  status: ["status", "selection_status"],
  reason: ["rejection_reason", "powod", "powód", "reason"],
};

function get(row: Record<string, unknown>, field: string): string {
  const keys = Object.keys(row);
  for (const alias of ALIASES[field]) {
    const k = keys.find((x) => x.trim().toLowerCase() === alias);
    if (k != null && row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

export function parseNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

/** Accepts 82, "82%", "82,5" or 0.82 and returns a percentage (0–100). */
export function parseProbability(v: string): number | null {
  const n = parseNumber(v);
  if (n == null) return null;
  const pct = n > 0 && n <= 1 && !v.includes("%") ? n * 100 : n;
  return pct >= 0 && pct <= 100 ? Math.round(pct * 100) / 100 : null;
}

export function normalizePick(v: string): string {
  const p = v.toUpperCase().replace(/\s|\//g, "");
  if (p === "X1") return "1X";
  if (p === "2X") return "X2";
  if (p === "21") return "12";
  return p;
}

function parseType(v: string, pick: string): PredictionType | null {
  const t = v.toUpperCase().replace(/\s|_/g, "");
  if (t === "1X2") return "1X2";
  if (t === "DC" || t === "DOUBLECHANCE" || t === "PODWÓJNASZANSA") return "DC";
  if (!t) {
    if (["1", "X", "2"].includes(pick)) return "1X2";
    if (["1X", "X2", "12"].includes(pick)) return "DC";
  }
  return null;
}

function parseKickoff(v: string): string | null {
  if (!v) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return brusselsInputToISO(v);
}

export function matchKey(kickoffIso: string, home: string, away: string) {
  return `${kickoffIso.slice(0, 16)}|${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

/**
 * Every valid row becomes a stored match. Weak predictions are kept with
 * status ODRZUCONY — rows are never silently dropped.
 */
export function parseScanRows(
  rows: Record<string, unknown>[],
  threshold = CANDIDATE_MIN_PROBABILITY,
): ParsedScan {
  const matches = new Map<string, ParsedMatch>();
  const predictions: ParsedPrediction[] = [];
  const errors: ParsedScan["errors"] = [];

  rows.forEach((row, i) => {
    const n = i + 2; // header is row 1
    const home = get(row, "home");
    const away = get(row, "away");
    const league = get(row, "league");
    const kickoff = parseKickoff(get(row, "kickoff"));
    if (!home || !away) return errors.push({ row: n, message: "Brak drużyn (home_team / away_team)." });
    if (home.toLowerCase() === away.toLowerCase())
      return errors.push({ row: n, message: "Gospodarze i goście są tacy sami." });
    if (!league) return errors.push({ row: n, message: "Brak ligi (league)." });
    if (!kickoff)
      return errors.push({ row: n, message: "Brak lub zły format daty (kickoff, np. 2026-11-14 20:45)." });

    const key = matchKey(kickoff, home, away);
    if (!matches.has(key))
      matches.set(key, {
        key,
        kickoff_at: kickoff,
        league,
        country: get(row, "country") || null,
        home_team: home,
        away_team: away,
      });

    const rawPick = get(row, "pick");
    if (!rawPick) return; // match without prediction is still stored
    const pick = normalizePick(rawPick);
    const type = parseType(get(row, "type"), pick);
    if (!type) return errors.push({ row: n, message: `Nieznany typ prognozy dla wyboru "${rawPick}".` });
    if (!isValidPick(type, pick))
      return errors.push({ row: n, message: `Wybór "${rawPick}" nie pasuje do typu ${type}.` });
    const probability = parseProbability(get(row, "probability"));
    if (probability == null)
      return errors.push({ row: n, message: "Brak lub zły format prawdopodobieństwa (0–100)." });
    const odds = parseNumber(get(row, "odds"));
    if (odds != null && odds <= 1)
      return errors.push({ row: n, message: "Kurs musi być większy niż 1.00." });

    const rawStatus = get(row, "status").toUpperCase();
    const status: SelectionStatus =
      rawStatus === "WYBRANY" || rawStatus === "ODRZUCONY"
        ? rawStatus
        : probability > threshold
          ? "WYBRANY"
          : "ODRZUCONY";
    const reason =
      get(row, "reason") ||
      (status === "ODRZUCONY" && !rawStatus ? `Prawdopodobieństwo ≤ ${threshold}%` : "");

    predictions.push({
      matchKey: key,
      prediction_type: type,
      pick: pick as Pick,
      probability,
      odds,
      confidence: get(row, "confidence") || null,
      selection_status: status,
      rejection_reason: reason || null,
    });
  });

  return { matches: [...matches.values()], predictions, errors };
}

export const SCAN_TEMPLATE_CSV =
  "kickoff,league,country,home_team,away_team,prediction_type,pick,probability,odds,confidence\n" +
  "2026-11-14 20:45,Liga,Kraj,Drużyna A,Drużyna B,1X2,1,78,1.65,wysoka\n";
