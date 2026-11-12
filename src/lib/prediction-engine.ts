import type { Match, MatchResult, Pick, PredictionType, SelectionStatus } from "./types";

export interface GeneratedPrediction {
  match_id: string;
  scan_run_id: string | null;
  prediction_type: PredictionType;
  pick: Pick;
  probability: number;
  confidence: string;
  odds: null;
  selection_status: SelectionStatus;
  rejection_reason: string | null;
  result_status: "pending";
  notes: string;
}

interface TeamForm {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
}

function poisson(lambda: number, maxGoals = 8): number[] {
  const values = [Math.exp(-lambda)];
  for (let i = 1; i <= maxGoals; i++) values.push(values[i - 1] * lambda / i);
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

function roundPct(value: number) {
  return Math.round(value * 10000) / 100;
}

function best<T extends string>(values: Record<T, number>): { pick: T; probability: number } {
  const pick = (Object.keys(values) as T[]).reduce((a, b) => values[b] > values[a] ? b : a);
  return { pick, probability: roundPct(values[pick]) };
}

/**
 * Transparent goals-only Poisson baseline. It deliberately does not pretend
 * to have xG, lineups or injury inputs. With fewer than 3 prior results for
 * either side, all generated picks are marked ODRZUCONY.
 */
export function generateMatchPredictions(
  match: Match,
  historicalMatches: Match[],
  historicalResults: MatchResult[],
  scanRunId: string | null,
): GeneratedPrediction[] {
  if (!match.kickoff_at || !match.home_team || !match.away_team) return [];
  const cutoff = new Date(match.kickoff_at).getTime();
  const matchById = new Map(historicalMatches.map((m) => [m.id, m]));
  const form = new Map<string, TeamForm>();
  const leagueGoals: number[] = [];

  for (const result of historicalResults) {
    if (result.home_goals == null || result.away_goals == null) continue;
    const prior = matchById.get(result.match_id);
    if (!prior?.kickoff_at || new Date(prior.kickoff_at).getTime() >= cutoff) continue;
    if (match.league && prior.league !== match.league) continue;
    const homeKey = prior.home_team?.trim().toLocaleLowerCase();
    const awayKey = prior.away_team?.trim().toLocaleLowerCase();
    if (!homeKey || !awayKey) continue;
    const home = form.get(homeKey) ?? { played: 0, goalsFor: 0, goalsAgainst: 0 };
    home.played++; home.goalsFor += result.home_goals; home.goalsAgainst += result.away_goals;
    form.set(homeKey, home);
    const away = form.get(awayKey) ?? { played: 0, goalsFor: 0, goalsAgainst: 0 };
    away.played++; away.goalsFor += result.away_goals; away.goalsAgainst += result.home_goals;
    form.set(awayKey, away);
    leagueGoals.push(result.home_goals, result.away_goals);
  }

  const homeKey = match.home_team.trim().toLocaleLowerCase();
  const awayKey = match.away_team.trim().toLocaleLowerCase();
  const homeForm = form.get(homeKey) ?? { played: 0, goalsFor: 0, goalsAgainst: 0 };
  const awayForm = form.get(awayKey) ?? { played: 0, goalsFor: 0, goalsAgainst: 0 };
  const averageGoals = leagueGoals.length ? leagueGoals.reduce((a, b) => a + b, 0) / leagueGoals.length : 1.35;
  const leagueAverage = Math.max(0.65, Math.min(2.2, averageGoals));
  const avg = (x: TeamForm, field: "goalsFor" | "goalsAgainst") => x.played ? x[field] / x.played : leagueAverage;
  const homeAttack = avg(homeForm, "goalsFor") / leagueAverage;
  const awayDefense = avg(awayForm, "goalsAgainst") / leagueAverage;
  const awayAttack = avg(awayForm, "goalsFor") / leagueAverage;
  const homeDefense = avg(homeForm, "goalsAgainst") / leagueAverage;
  const lambdaHome = Math.max(0.15, Math.min(4.2, leagueAverage * homeAttack * awayDefense * 1.08));
  const lambdaAway = Math.max(0.15, Math.min(4.2, leagueAverage * awayAttack * homeDefense * 0.92));
  const hp = poisson(lambdaHome);
  const ap = poisson(lambdaAway);
  let one = 0, draw = 0, two = 0;
  for (let h = 0; h < hp.length; h++) for (let a = 0; a < ap.length; a++) {
    const p = hp[h] * ap[a];
    if (h > a) one += p;
    else if (h === a) draw += p;
    else two += p;
  }

  const oneXtwo = best({ "1": one, X: draw, "2": two });
  const doubleChance = best({ "1X": one + draw, X2: draw + two, "12": one + two });
  const enoughHistory = homeForm.played >= 3 && awayForm.played >= 3;
  const sample = Math.min(homeForm.played, awayForm.played);
  const confidence = enoughHistory ? (sample >= 8 ? "Średnia · model bramkowy" : "Niska · model bramkowy") : "Bardzo niska · za mało historii";
  const make = (type: PredictionType, pick: Pick, probability: number): GeneratedPrediction => {
    const selected = enoughHistory && probability > 75;
    return {
      match_id: match.id,
      scan_run_id: scanRunId,
      prediction_type: type,
      pick,
      probability,
      confidence,
      odds: null,
      selection_status: selected ? "WYBRANY" : "ODRZUCONY",
      rejection_reason: selected ? null : !enoughHistory ? "Za mało historycznych wyników dla obu drużyn (minimum 3)." : "Prawdopodobieństwo modelu nie przekracza 75%.",
      result_status: "pending",
      notes: "Model Poissona oparty na golach historycznych; bez xG, składów i kontuzji. Wynik eksperymentalny, wymaga kalibracji.",
    };
  };
  return [make("1X2", oneXtwo.pick, oneXtwo.probability), make("DC", doubleChance.pick, doubleChance.probability)];
}
