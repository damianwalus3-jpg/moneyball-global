export type EvidenceStatus = "VERIFIED" | "PARTIAL" | "MISSING" | "STALE" | "CONFLICT";
export type EvidenceArea = "xg_xga" | "confirmed_lineups" | "injuries" | "suspensions" | "shots_and_chances" | "tactics" | "schedule_fatigue" | "current_odds_ev";
export interface EvidenceItem { status: EvidenceStatus; source: string | null; observedAt: string | null; note: string; }
export interface EvidenceAudit { complete: boolean; areas: Record<EvidenceArea, EvidenceItem>; assessedAt: string; }
const LABELS: Record<EvidenceArea, string> = {
  xg_xga: "xG/xGA", confirmed_lineups: "potwierdzone składy", injuries: "potwierdzone kontuzje",
  suspensions: "zawieszenia", shots_and_chances: "strzały i jakość sytuacji", tactics: "taktyka i ustawienie",
  schedule_fatigue: "zmęczenie terminarzem", current_odds_ev: "aktualne kursy i EV",
};
export function buildBaselineEvidenceAudit(now = new Date().toISOString()): EvidenceAudit {
  const areas = Object.fromEntries((Object.keys(LABELS) as EvidenceArea[]).map(key => [key, {
    status: "MISSING" as const, source: null, observedAt: null,
    note: "Brak zintegrowanego, zweryfikowanego odczytu dla tego meczu.",
  }])) as Record<EvidenceArea, EvidenceItem>;
  return { complete: false, areas, assessedAt: now };
}
export function isEvidenceAuditComplete(audit: EvidenceAudit): boolean {
  const assessed = Date.parse(audit.assessedAt);
  if (!Number.isFinite(assessed)) return false;
  return (Object.keys(LABELS) as EvidenceArea[]).every(key => {
    const item = audit.areas?.[key];
    if (!item || item.status !== "VERIFIED" || !item.source || !item.source.trim() || !item.observedAt) return false;
    const observed = Date.parse(item.observedAt);
    return Number.isFinite(observed) && observed <= assessed;
  });
}
export function getEvidenceGaps(audit: EvidenceAudit): string[] {
  return (Object.keys(LABELS) as EvidenceArea[]).filter(key => {
    const item = audit.areas?.[key];
    return !item || item.status !== "VERIFIED" || !item.source || !item.observedAt;
  }).map(key => LABELS[key]);
}
