import { CANDIDATE_MIN_PROBABILITY, isValidPick } from "./domain";
import { brusselsInputToISO } from "./time";
import type { Gender, Market, Selection, Verdict } from "./types";

export interface ParsedMatch {
  key: string;
  kickoff_at: string;
  competition: string | null;
  country: string | null;
  gender: Gender;
  home_team: string;
  away_team: string;
}

export interface ParsedPrediction {
  matchKey: string;
  market: Market;
  selection: Selection;
  probability: number | null;
  odds: number | null;
  confidence: string | null;
  verdict: Verdict;
  rationale: string | null;
  model_version: string;
  group_name: string;
}

export interface ParsedScan {
  matches: ParsedMatch[];
  predictions: ParsedPrediction[];
  errors: { row: number; message: string }[];
}

function value(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  return raw == null ? "" : String(raw).trim();
}

export function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const number = Number(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(number) ? number : null;
}

export function parseProbability(raw: string): number | null {
  const number = parseNumber(raw);
  if (number == null) return null;
  const percent = number > 0 && number <= 1 && !raw.includes("%") ? number * 100 : number;
  return percent >= 0 && percent <= 100 ? Math.round(percent * 100) / 100 : null;
}

export function normalizeSelection(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, "");
}

function parseMarket(raw: string, selection: string): Market | null {
  const market = raw.trim().toUpperCase().replace(/\s/g, "_");
  if (market === "1X2") return "1X2";
  if (market === "DOUBLE_CHANCE") return "DOUBLE_CHANCE";
  if (market === "GOALS") return "GOALS";
  if (!market) {
    if (["1", "X", "2"].includes(selection)) return "1X2";
    if (["1X", "X2", "12"].includes(selection)) return "DOUBLE_CHANCE";
    if (["BTTS_YES", "BTTS_NO", "OVER_1.5", "UNDER_1.5", "OVER_2.5", "UNDER_2.5", "OVER_3.5", "UNDER_3.5"].includes(selection)) return "GOALS";
  }
  return null;
}

function parseGender(raw: string): Gender {
  const gender = raw.trim().toLowerCase();
  if (gender === "men" || gender === "women" || gender === "mixed") return gender;
  return "unknown";
}

function parseKickoff(raw: string): string | null {
  if (!raw) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return brusselsInputToISO(raw);
}

export function matchKey(
  kickoffIso: string,
  home: string,
  away: string,
  competition = "",
  gender: Gender | null = "unknown",
) {
  return [
    kickoffIso.slice(0, 16),
    home.trim().toLowerCase(),
    away.trim().toLowerCase(),
    (competition ?? "").trim().toLowerCase(),
    gender ?? "unknown",
  ].join("|");
}

/** Canonical CSV parser. It stores every valid match and never invents a prediction. */
export function parseScanRows(
  rows: Record<string, unknown>[],
  threshold = CANDIDATE_MIN_PROBABILITY,
): ParsedScan {
  const matches = new Map<string, ParsedMatch>();
  const predictions: ParsedPrediction[] = [];
  const errors: ParsedScan["errors"] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const home = value(row, "home_team");
    const away = value(row, "away_team");
    const competition = value(row, "competition") || null;
    const kickoff = parseKickoff(value(row, "kickoff_at"));
    const gender = parseGender(value(row, "gender"));

    if (!home || !away) {
      errors.push({ row: rowNumber, message: "Brak home_team lub away_team." });
      return;
    }
    if (home.toLowerCase() === away.toLowerCase()) {
      errors.push({ row: rowNumber, message: "home_team i away_team nie mogą być takie same." });
      return;
    }
    if (!kickoff) {
      errors.push({ row: rowNumber, message: "Brak lub błędny kickoff_at (czas lokalny Europe/Brussels albo ISO)." });
      return;
    }

    const key = matchKey(kickoff, home, away, competition ?? "", gender);
    if (!matches.has(key)) {
      matches.set(key, {
        key,
        kickoff_at: kickoff,
        competition,
        country: value(row, "country") || null,
        gender,
        home_team: home,
        away_team: away,
      });
    }

    const rawMarket = value(row, "market");
    const rawSelection = value(row, "selection");
    if (!rawMarket && !rawSelection) return;
    const selection = normalizeSelection(rawSelection);
    const market = parseMarket(rawMarket, selection);
    if (!market || !isValidPick(market, selection)) {
      errors.push({ row: rowNumber, message: "market/selection nie pasują. Użyj 1X2 z 1/X/2, DOUBLE_CHANCE z 1X/X2/12 albo GOALS z BTTS/Over/Under." });
      return;
    }

    const probability = parseProbability(value(row, "probability"));
    const odds = parseNumber(value(row, "odds"));
    if (odds != null && odds <= 1) {
      errors.push({ row: rowNumber, message: "odds musi być większe niż 1.00." });
      return;
    }
    if (value(row, "probability") && probability == null) {
      errors.push({ row: rowNumber, message: "probability musi być liczbą od 0 do 100." });
      return;
    }

    const rawVerdict = value(row, "verdict").toUpperCase();
    const verdict: Verdict =
      rawVerdict === "WYBRANY" || rawVerdict === "ODRZUCONY"
        ? rawVerdict
        : probability != null && probability > threshold
          ? "WYBRANY"
          : "ODRZUCONY";

    predictions.push({
      matchKey: key,
      market,
      selection: selection as Selection,
      probability,
      odds,
      confidence: value(row, "confidence") || null,
      verdict,
      rationale: value(row, "rationale") || null,
      model_version: value(row, "model_version") || "MANUAL_IMPORT",
      group_name: value(row, "group_name") || "TEST",
    });
  });

  return { matches: [...matches.values()], predictions, errors };
}

export const SCAN_TEMPLATE_CSV =
  "kickoff_at,competition,country,gender,home_team,away_team,market,selection,probability,odds,confidence,verdict,rationale,model_version,group_name\n" +
  "2026-11-14 20:45,Premier League,England,men,Team A,Team B,1X2,1,78,1.65,wysoka,WYBRANY,Przykładowe uzasadnienie,MONEYBALL GLOBAL 3.9,TEST\n";
