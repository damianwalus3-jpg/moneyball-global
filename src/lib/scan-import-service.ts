import { fetchAll, insertRow, insertRows, updateRow } from "./db";
import { matchKey, type ParsedScan } from "./scan-import";
import { brusselsDayKey } from "./time";
import type { Match, Prediction } from "./types";

/** Imports canonical CSV rows. Existing matches and predictions are skipped, never overwritten. */
export async function importScan(parsed: ParsedScan, existingMatches: Match[], source: string) {
  if (parsed.errors.length) throw new Error("Popraw błędy w pliku przed importem.");
  if (parsed.matches.length === 0) throw new Error("Plik nie zawiera meczów.");

  const scan = await insertRow("scan_runs", {
    scan_date: brusselsDayKey(new Date()),
    source: source.trim() || "import CSV",
    started_at: new Date().toISOString(),
    status: "started",
    matches_found: 0,
    notes: null,
  });

  try {
    const existingByKey = new Map<string, Match>();
    for (const match of existingMatches) {
      if (!match.kickoff_at) continue;
      const key = matchKey(
        match.kickoff_at,
        match.home_team,
        match.away_team,
        match.competition ?? "",
        match.gender,
      );
      if (!existingByKey.has(key)) existingByKey.set(key, match);
    }

    const matchIdByKey = new Map<string, string>();
    const newMatches = parsed.matches.filter((match) => {
      const existing = existingByKey.get(match.key);
      if (existing) {
        matchIdByKey.set(match.key, existing.id);
        return false;
      }
      return true;
    });

    const insertedMatches = await insertRows(
      "matches",
      newMatches.map((match) => ({
        scan_run_id: scan.id,
        external_id: null,
        source: source.trim() || "import CSV",
        competition: match.competition,
        country: match.country,
        gender: match.gender,
        home_team: match.home_team,
        away_team: match.away_team,
        kickoff_at: match.kickoff_at,
        status: "scheduled",
      })),
    );

    for (const match of insertedMatches) {
      const key = matchKey(
        match.kickoff_at ?? "",
        match.home_team,
        match.away_team,
        match.competition ?? "",
        match.gender,
      );
      matchIdByKey.set(key, match.id);
    }

    const existingPredictions = await fetchAll("predictions");
    const existingPredictionKeys = new Set(
      existingPredictions.map((prediction) =>
        [prediction.match_id, prediction.model_version, prediction.market, prediction.selection].join("|"),
      ),
    );

    const predictionsToInsert: Record<string, unknown>[] = [];
    for (const parsedPrediction of parsed.predictions) {
      const matchId = matchIdByKey.get(parsedPrediction.matchKey);
      if (!matchId) throw new Error("Nie udało się powiązać prognozy z meczem.");
      const key = [
        matchId,
        parsedPrediction.model_version,
        parsedPrediction.market,
        parsedPrediction.selection,
      ].join("|");
      if (existingPredictionKeys.has(key)) continue;
      existingPredictionKeys.add(key);
      predictionsToInsert.push({
        match_id: matchId,
        model_version: parsedPrediction.model_version,
        market: parsedPrediction.market,
        selection: parsedPrediction.selection,
        probability: parsedPrediction.probability,
        confidence: parsedPrediction.confidence,
        verdict: parsedPrediction.verdict,
        rationale: parsedPrediction.rationale,
        group_name: parsedPrediction.group_name,
        odds: parsedPrediction.odds,
        settlement_status: "pending",
        verified: false,
        note: null,
      });
    }

    let insertedPredictions = 0;
    for (let index = 0; index < predictionsToInsert.length; index += 500) {
      const batch = await insertRows("predictions", predictionsToInsert.slice(index, index + 500));
      insertedPredictions += batch.length;
    }

    await updateRow("scan_runs", scan.id, {
      status: "completed",
      matches_found: parsed.matches.length,
      completed_at: new Date().toISOString(),
      notes: `Nowe mecze: ${insertedMatches.length}; ponownie użyte: ${parsed.matches.length - insertedMatches.length}; nowe prognozy: ${insertedPredictions}.`,
    });

    return {
      newMatches: insertedMatches.length,
      reusedMatches: parsed.matches.length - insertedMatches.length,
      predictions: insertedPredictions,
    };
  } catch (error) {
    await updateRow("scan_runs", scan.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      notes: error instanceof Error ? error.message : "Nieznany błąd importu.",
    }).catch(() => undefined);
    throw error;
  }
}
