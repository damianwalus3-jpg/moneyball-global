export type EvidenceStatus = "VERIFIED" | "PARTIAL" | "MISSING" | "STALE" | "CONFLICT";
export type EvidenceArea = "xg_xga" | "confirmed_lineups" | "injuries" | "suspensions" | "shots_and_chances" | "tactics" | "schedule_fatigue" | "current_odds_ev";
export interface EvidenceItem { status: EvidenceStatus; source: string | null; observedAt: string | null; note: string; }
export interface EvidenceAudit { complete: boolean; areas: Record<EvidenceArea, EvidenceItem>; assessedAt: string; }
const CORE_AREAS: EvidenceArea[] = [
  "xg_xga", "confirmed_lineups", "injuries", "suspensions",
  "shots_and_chances", "tactics", "schedule_fatigue",
];
const LABELS: Record<EvidenceArea, string> = {
  xg_xga: "xG/xGA", confirmed_lineups: "potwierdzone składy", injuries: "potwierdzone kontuzje",
  suspensions: "zawieszenia", shots_and_chances: "strzały i jakość sytuacji", tactics: "taktyka i ustawienie",
  schedule_fatigue: "zmęczenie terminarzem", current_odds_ev: "aktualne kursy i EV (wycena zakładu)",
};
export function buildBaselineEvidenceAudit(now = new Date().toISOString()): EvidenceAudit {
  const areas = Object.fromEntries((Object.keys(LABELS) as EvidenceArea[]).map(key => [key, {
    status: "MISSING" as const, source: null, observedAt: null,
    note: key === "current_odds_ev"
      ? "Warstwa wyceny zakładu. Brak kursu nie blokuje zapisu ani oceny prognozy sportowej."
      : "Brak zintegrowanego, zweryfikowanego odczytu dla tego meczu.",
  }])) as Record<EvidenceArea, EvidenceItem>;
  return { complete: false, areas, assessedAt: now };
}
function isVerifiedAtAssessment(item: EvidenceItem | undefined, assessed: number): boolean {
  if (!item || item.status !== "VERIFIED" || !item.source || !item.source.trim() || !item.observedAt) return false;
  const observed = Date.parse(item.observedAt);
  return Number.isFinite(observed) && observed <= assessed;
}
/** Sports-analysis readiness is independent of bookmaker availability and price. */
export function isEvidenceAuditComplete(audit: EvidenceAudit): boolean {
  const assessed = Date.parse(audit.assessedAt);
  if (!Number.isFinite(assessed)) return false;
  return CORE_AREAS.every(key => isVerifiedAtAssessment(audit.areas?.[key], assessed));
}
/** A separate gate for priced betting decisions; never use it to suppress a match prediction. */
export function isBettingEvidenceComplete(audit: EvidenceAudit): boolean {
  const assessed = Date.parse(audit.assessedAt);
  return Number.isFinite(assessed)
    && isEvidenceAuditComplete(audit)
    && isVerifiedAtAssessment(audit.areas?.current_odds_ev, assessed);
}
export function getEvidenceGaps(audit: EvidenceAudit): string[] {
  return CORE_AREAS.filter(key => !isVerifiedAtAssessment(audit.areas?.[key], Date.parse(audit.assessedAt)))
    .map(key => LABELS[key]);
}
export function getBettingEvidenceGaps(audit: EvidenceAudit): string[] {
  const gaps = getEvidenceGaps(audit);
  if (!isVerifiedAtAssessment(audit.areas?.current_odds_ev, Date.parse(audit.assessedAt))) {
    gaps.push(LABELS.current_odds_ev);
  }
  return gaps;
}
