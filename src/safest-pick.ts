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
export function getSafestPick(records: TrackerRecord[], minimum = 0.75): SafestPick | null {
  const now = brusselsNowParts(), latest = new Map<string, TrackerRecord>();
  for (const row of records) {
    if (row.kind !== "prediction" || row.details.market !== "DOUBLE_CHANCE" || typeof row.details.fixtureId !== "string") continue;
    const key = row.details.fixtureId + "|" + String(row.details.model ?? "legacy"), current = latest.get(key);
    if (!current || Date.parse(row.createdAt) > Date.parse(current.createdAt)) latest.set(key, row);
  }
  const candidates: SafestPick[] = [];
  for (const row of latest.values()) {
    const d = row.details;
    if (row.status !== "KANDYDAT" || typeof d.fixtureDate !== "string" || typeof d.fixtureTime !== "string"
      || !hasKnownKickoff(d.fixtureDate, d.fixtureTime) || d.fixtureDate < now.date
      || (d.fixtureDate === now.date && d.fixtureTime <= now.time)) continue;
    const selection = d.selection, probability = d.probability;
    if (!["1X", "X2", "12"].includes(String(selection)) || typeof probability !== "number" || probability < minimum || probability > 1) continue;
    candidates.push({ fixtureId: d.fixtureId as string, title: row.title,
      competition: typeof d.competition === "string" ? d.competition : "Rozgrywki nieustalone",
      market: selection as SafestPick["market"], probability, kickoff: d.fixtureDate + " " + d.fixtureTime,
      reason: "Najwyższe prawdopodobieństwo Double Chance z osobnego rekordu rynku; próg selekcji 75%." });
  }
  return candidates.sort((a, b) => b.probability - a.probability)[0] ?? null;
}
