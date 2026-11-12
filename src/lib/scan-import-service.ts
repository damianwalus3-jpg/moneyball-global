import { deleteRow, insertRow, insertRows, updateRow } from "./db";
import { matchKey, type ParsedScan } from "./scan-import";
import type { Match } from "./types";

/**
 * Stores a parsed scan: one scan_run, every match (reusing identical existing
 * matches), and every prediction including ODRZUCONY ones.
 *
 * Supabase's browser client has no multi-table transaction API, so this service
 * compensates successful inserts if a later step fails. Reused matches are never
 * modified or deleted by rollback.
 */
export async function importScan(parsed: ParsedScan, existing: Match[], source: string) {
  if (parsed.errors.length) throw new Error("Popraw błędy w pliku przed importem.");
  if (parsed.matches.length === 0) throw new Error("Plik nie zawiera meczów.");

  const scan = await insertRow("scan_runs", {
    started_at: new Date().toISOString(),
    source: source.trim() || "import CSV",
    matches_count: parsed.matches.length,
  });

  let insertedMatches: Match[] = [];
  const insertedPredictionIds: string[] = [];

  try {
    const existingByKey = new Map<string, Match>();
    for (const m of existing) {
      if (m.kickoff_at && m.home_team && m.away_team) {
        existingByKey.set(matchKey(new Date(m.kickoff_at).toISOString(), m.home_team, m.away_team), m);
      }
    }

    const idByKey = new Map<string, string>();
    const toInsert = parsed.matches.filter((m) => {
      const found = existingByKey.get(m.key);
      if (found) idByKey.set(m.key, found.id);
      return !found;
    });

    insertedMatches = await insertRows(
      "matches",
      toInsert.map((m) => ({
        scan_run_id: scan.id,
        kickoff_at: m.kickoff_at,
        league: m.league,
        country: m.country,
        home_team: m.home_team,
        away_team: m.away_team,
        status: "scheduled",
      })),
    );
    for (const m of insertedMatches) {
      if (m.kickoff_at && m.home_team && m.away_team) {
        idByKey.set(matchKey(new Date(m.kickoff_at).toISOString(), m.home_team, m.away_team), m.id);
      }
    }

    const preds = parsed.predictions.map((p) => {
      const match_id = idByKey.get(p.matchKey);
      if (!match_id) throw new Error("Nie udało się powiązać prognozy z meczem.");
      return {
        match_id,
        scan_run_id: scan.id,
        prediction_type: p.prediction_type,
        pick: p.pick,
        probability: p.probability,
        odds: p.odds,
        confidence: p.confidence,
        selection_status: p.selection_status,
        rejection_reason: p.rejection_reason,
        result_status: "pending",
      };
    });

    for (let i = 0; i < preds.length; i += 500) {
      const saved = await insertRows("predictions", preds.slice(i, i + 500));
      insertedPredictionIds.push(...saved.map((p) => p.id));
    }

    await updateRow("scan_runs", scan.id, { matches_count: parsed.matches.length });
    return {
      newMatches: insertedMatches.length,
      reusedMatches: parsed.matches.length - insertedMatches.length,
      predictions: preds.length,
    };
  } catch (error) {
    const rollbackErrors: string[] = [];
    const rollback = async (table: "predictions" | "matches" | "scan_runs", ids: string[]) => {
      for (const id of [...ids].reverse()) {
        try {
          await deleteRow(table, id);
        } catch (rollbackError) {
          rollbackErrors.push(`${table}/${id}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
    };

    await rollback("predictions", insertedPredictionIds);
    await rollback("matches", insertedMatches.map((m) => m.id));
    await rollback("scan_runs", [scan.id]);

    const reason = error instanceof Error ? error.message : String(error);
    if (rollbackErrors.length) {
      throw new Error(`Import skanu nie powiódł się: ${reason}. Niepełne cofnięcie: ${rollbackErrors.join("; ")}`);
    }
    throw new Error(`Import skanu został cofnięty po błędzie: ${reason}`);
  }
}
