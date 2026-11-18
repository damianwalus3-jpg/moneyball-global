export function isRealXgObservation(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || row["xg_for"] == null || row["xg_against"] == null) return false;
  const xgFor = Number(row["xg_for"]);
  const xgAgainst = Number(row["xg_against"]);
  if (!Number.isFinite(xgFor) || !Number.isFinite(xgAgainst) || xgFor < 0 || xgAgainst < 0) return false;
  const source = String(row["source"] ?? row["xg_source"] ?? "").trim().toLowerCase();
  if (!source || /^(?:unknown|none|historical_xg|goals?|goal_diff|w\/?d\/?l|results?)$/.test(source)) return false;
  return true;
}
