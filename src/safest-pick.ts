import type { TrackerRecord } from "./tracker-store";
export interface SafestPick { fixtureId: string; title: string; competition: string; market: "1X" | "X2" | "12"; probability: number; kickoff: string; reason: string; }
function brusselsNowParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return { date: get("year") + "-" + get("month") + "-" + get("day"), time: get("hour") + ":" + get("minute") };
}
export function hasKnownKickoff(date: string, time: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || !/^[0-9]{2}:[0-9]{2}$/.test(time)) return false;
  const parsed = Date.parse(date + "T" + time + ":00Z");
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date;
}
export function hasKickoffPassed(date: string, time: string): boolean {
  if (!hasKnownKickoff(date, time)) return false;
  const now = brusselsNowParts();
  return date < now.date || (date === now.date && time <= now.time);
}
export function getSafestPick(records: TrackerRecord[], minimum = 0.75, targetDate?: string): SafestPick | null {
  const now = brusselsNowParts();
  const latest = new Map<string, TrackerRecord>();
  for (const row of records) {
    if (row.kind !== "prediction" || typeof row.details.fixtureId !== "string") continue;
    const model = String(row.details.model ?? "legacy");
    const market = row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
    const key = row.details.fixtureId + "|" + model + "|" + market;
    const current = latest.get(key);
    if (!current || Date.parse(row.createdAt) > Date.parse(current.createdAt)) latest.set(key, row);
  }
  const explicitKeys = new Set([...latest.entries()].filter(([key]) => key.endsWith("|DOUBLE_CHANCE"))
    .map(([key]) => key.slice(0, key.lastIndexOf("|"))));
  const candidates: SafestPick[] = [];
  for (const row of latest.values()) {
    const d = row.details;
    if (d.evidenceComplete !== true) continue;
    if (targetDate && d.fixtureDate !== targetDate) continue;
    if (row.status !== "KANDYDAT" && row.status !== "KANDYDAT_DC") continue;
    if (typeof d.fixtureDate !== "string" || typeof d.fixtureTime !== "string" || !hasKnownKickoff(d.fixtureDate, d.fixtureTime)
      || d.fixtureDate < now.date || (d.fixtureDate === now.date && d.fixtureTime <= now.time)) continue;
    let selection: unknown = d.selection, probability: unknown = d.probability;
    if (d.market !== "DOUBLE_CHANCE") {
      const key = String(d.fixtureId) + "|" + String(d.model ?? "legacy");
      if (explicitKeys.has(key)) continue;
      const legacy = [
        { selection: "1X", probability: d.dc1x },
        { selection: "X2", probability: d.dcx2 },
        { selection: "12", probability: d.dc12 },
      ].filter(item => typeof item.probability === "number" && Number.isFinite(item.probability))
        .sort((a, b) => (b.probability as number) - (a.probability as number))[0];
      selection = legacy?.selection;
      probability = legacy?.probability;
    }
    if (!["1X", "X2", "12"].includes(String(selection)) || typeof probability !== "number" || probability < minimum || probability > 1) continue;
    candidates.push({ fixtureId: d.fixtureId as string, title: row.title,
      competition: typeof d.competition === "string" ? d.competition : "Rozgrywki nieustalone",
      market: selection as SafestPick["market"], probability, kickoff: d.fixtureDate + " " + d.fixtureTime,
      reason: "Najwyższe prawdopodobieństwo Double Chance; próg selekcji 75%." });
  }
  return candidates.sort((a, b) => b.probability - a.probability)[0] ?? null;
}
