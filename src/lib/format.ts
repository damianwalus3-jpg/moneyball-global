import { readPrefs } from "./config";
import type { Match } from "./types";

const num2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export function fmtPct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(Number(v)) ? "—" : `${num1.format(Number(v))}%`;
}
export function fmtOdds(v: number | null | undefined): string {
  return v == null || !Number.isFinite(Number(v)) ? "—" : num2.format(Number(v));
}
export function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const cur = readPrefs().currency;
  return `${num2.format(Number(v))}${cur ? ` ${cur}` : ""}`;
}
export function matchLabel(m: Match | undefined | null): string {
  if (!m) return "Nieznany mecz";
  return `${m.home_team ?? "?"} – ${m.away_team ?? "?"}`;
}

/** Parses a user-typed decimal ("1,85" or "1.85"). */
export function parseDecimal(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}
