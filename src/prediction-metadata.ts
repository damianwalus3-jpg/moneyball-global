import type { PitchApiXgForm } from "./pitchapi";
import type { TeamForm } from "./team-form";

export type ModelSourceType = "goals_results_history" | "xg_history" | "baseline_only" | "unavailable";
export interface PitchApiXgForms { home: PitchApiXgForm; away: PitchApiXgForm; }

function validNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** xG is verified only when both teams have at least three dated, prior PitchAPI rows with real xG/xGA values. */
export function hasVerifiedXgHistory(forms: PitchApiXgForms | undefined, cutoffDate: string): boolean {
  if (!forms || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) return false;
  return [forms.home, forms.away].every(form =>
    form.source === "PitchAPI" && Number.isInteger(form.sampleSize) && form.sampleSize >= 3
    && form.matches.length >= 3
    && validNonNegative(form.xgForPerMatch) && validNonNegative(form.xgAgainstPerMatch)
    && form.matches.every(match => typeof match.date === "string" && match.date < cutoffDate
      && validNonNegative(match.xgFor) && validNonNegative(match.xgAgainst)),
  );
}

function recentGoalsResults(form: TeamForm) {
  return form.matches.slice(0, 5).map(match => ({
    date: match.date, opponent: match.opponent, venue: match.venue,
    goalsFor: match.goalsFor, goalsAgainst: match.goalsAgainst, result: match.result,
  }));
}

/** Stores actual recent goals/results history; these fields are deliberately not called xG. */
export function buildHistoryProvenance(homeForm: TeamForm | undefined, awayForm: TeamForm | undefined, cutoffDate: string): string | null {
  if (!homeForm || !awayForm) return null;
  const side = (form: TeamForm) => ({
    source: form.source, sourceUpdatedAt: form.sourceUpdatedAt,
    matches: form.matches.length, homeMatches: form.home.length, awayMatches: form.away.length,
    recentMatches: recentGoalsResults(form),
  });
  return JSON.stringify({
    home: side(homeForm), away: side(awayForm), cutoffDateExclusive: cutoffDate,
    semantics: "Bramki/wyniki historyczne — nie xG.",
  });
}

export function buildPredictionModelMetadata(
  method: string,
  homeForm: TeamForm | undefined,
  awayForm: TeamForm | undefined,
  xgForms: PitchApiXgForms | undefined,
  cutoffDate: string,
): { modelSourceType: ModelSourceType; modelCoverage: string; xgUsed: boolean; xgSource: string | null } {
  const xgVerified = hasVerifiedXgHistory(xgForms, cutoffDate);
  const goalsHistoryQualified = method === "recent-form-goals-poisson"
    && (homeForm?.matches.length ?? 0) >= 3 && (awayForm?.matches.length ?? 0) >= 3;
  const xgUsed = method === "pitchapi-recent-xg-poisson" && xgVerified;
  const modelSourceType: ModelSourceType = method === "neutral-prior-poisson" ? "baseline_only"
    : goalsHistoryQualified ? "goals_results_history"
      : xgUsed ? "xg_history" : "unavailable";
  const modelCoverage = {
    modelSourceType,
    goalsResults: {
      homeSource: homeForm?.source ?? null, awaySource: awayForm?.source ?? null,
      homeMatches: homeForm?.matches.length ?? 0, awayMatches: awayForm?.matches.length ?? 0,
      homeHomeMatches: homeForm?.home.length ?? 0, homeAwayMatches: homeForm?.away.length ?? 0,
      awayHomeMatches: awayForm?.home.length ?? 0, awayAwayMatches: awayForm?.away.length ?? 0,
      semantics: "goals_for_against_results_only_not_xG",
    },
    xg: {
      source: xgUsed ? "PitchAPI" : null,
      verifiedRealXgFields: xgVerified,
      homeSampleSize: xgForms?.home.sampleSize ?? 0,
      awaySampleSize: xgForms?.away.sampleSize ?? 0,
    },
  };
  return { modelSourceType, modelCoverage: JSON.stringify(modelCoverage), xgUsed, xgSource: xgUsed ? "PitchAPI" : null };
}
