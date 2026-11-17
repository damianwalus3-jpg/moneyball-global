import type { TrackerRecord } from "./tracker-store";

export interface SafestPick {
  fixtureId: string;
  title: string;
  competition: string;
  market: "1X" | "X2" | "12";
  probability: number;
  kickoff: string;
  reason: string;
}

function brusselsNowParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function hasKickoffPassed(date: string, time: string): boolean {\n  if (time === "—" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^\\d{2}:\\d{2}$/.test(time)) return false;\n  const now = brusselsNowParts();\n  return date < now.date || (date === now.date && time <= now.time);\n}\n\nexport function getSafestPick(records: TrackerRecord[], minimum = 0.8): SafestPick | null {
  const now = brusselsNowParts();
  const newest = new Map<string, TrackerRecord>();
  for (const row of records) {
    if (row.kind !== "prediction" || typeof row.details.fixtureId !== "string" || newest.has(row.details.fixtureId)) continue;
    newest.set(row.details.fixtureId, row);
  }
  const candidates: SafestPick[] = [];
  for (const row of newest.values()) {
    const d = row.details;
    if (row.status !== "KANDYDAT" || typeof d.fixtureDate !== "string" || typeof d.fixtureTime !== "string") continue;
    if (d.fixtureDate < now.date || (d.fixtureDate === now.date && d.fixtureTime <= now.time)) continue;
    const markets: Array<{ market: SafestPick["market"]; probability: unknown }> = [
      { market: "1X", probability: d.dc1x },
      { market: "X2", probability: d.dcx2 },
      { market: "12", probability: d.dc12 },
    ];
    const best = markets.filter(item => typeof item.probability === "number" && Number.isFinite(item.probability) && item.probability >= minimum && item.probability <= 1)
      .sort((a, b) => (b.probability as number) - (a.probability as number))[0];
    if (!best) continue;
    candidates.push({
      fixtureId: d.fixtureId as string,
      title: row.title,
      competition: typeof d.competition === "string" ? d.competition : "Rozgrywki nieustalone",
      market: best.market,
      probability: best.probability as number,
      kickoff: `${d.fixtureDate} ${d.fixtureTime}`,
      reason: "Najwyższe dostępne prawdopodobieństwo Double Chance wśród zapisanych kandydatów; próg selekcji 80%. DC jest wyliczane z modelu 1X2, a nie trenowane niezależnie.",
    });
  }
  return candidates.sort((a, b) => b.probability - a.probability)[0] ?? null;
}
