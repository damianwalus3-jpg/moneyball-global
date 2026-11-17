import type { TrackerRecord } from "./tracker-store";

export function selectionWon(selection: string, actual: string): boolean {
  if (!["1", "X", "2"].includes(actual)) return false;
  if (selection === "1X") return actual === "1" || actual === "X";
  if (selection === "X2") return actual === "X" || actual === "2";
  if (selection === "12") return actual === "1" || actual === "2";
  return selection === actual;
}

export function buildBetSettlementRows(records: TrackerRecord[]): Array<Omit<TrackerRecord, "id" | "createdAt">> {
  const results = new Map<string, string>();
  const newestFirst = [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const row of newestFirst) {
    if (row.kind === "result" && typeof row.details.fixtureId === "string"
      && ["1", "X", "2"].includes(String(row.details.actual)) && !results.has(row.details.fixtureId)) {
      results.set(row.details.fixtureId, String(row.details.actual));
    }
  }
  const existingSettlements = new Set(records
    .filter(row => row.kind === "bet" && typeof row.details.parentBetId === "string")
    .map(row => String(row.details.parentBetId)));
  return records.flatMap(row => {
    if (row.kind !== "bet" || typeof row.details.fixtureId !== "string"
      || !["SELECTED", "REJECTED"].includes(String(row.details.decision)) || existingSettlements.has(row.id)) return [];
    const actual = results.get(row.details.fixtureId);
    if (!actual) return [];
    const selection = String(row.details.selection ?? row.details.market ?? "");
    if (!["1", "X", "2", "1X", "X2", "12"].includes(selection)) return [];
    const won = selectionWon(selection, actual);
    const selected = row.details.decision === "SELECTED";
    const stake = Number(row.details.stake);
    const odds = Number(row.details.odds);
    if (!Number.isFinite(odds) || odds <= 1 || (selected && (!Number.isFinite(stake) || stake <= 0))) return [];
    const profitLoss = selected ? (won ? stake * (odds - 1) : -stake) : 0;
    return [{
      kind: "bet" as const,
      title: `${row.title} · wynik ${actual}`,
      status: selected ? (won ? "WON" : "LOST") : (won ? "ODRZUCONY_TRAFIŁ" : "ODRZUCONY_NIE_TRAFIŁ"),
      details: {
        parentBetId: row.id,
        fixtureId: row.details.fixtureId,
        decision: row.details.decision,
        selection,
        actual,
        stake: selected ? stake : 0,
        odds,
        profitLoss,
      },
    }];
  });
}
