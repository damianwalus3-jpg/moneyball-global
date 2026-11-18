import { predictFromExpectedGoals, type PoissonPrediction } from "./prediction-engine";
import type { TeamForm } from "./team-form";
import type { PitchApiXgForm } from "./pitchapi";

export interface FormPrediction {
  prediction: PoissonPrediction;
  pick: "1" | "X" | "2";
  topProbability: number;
  strongCandidate: boolean;
  samples: {
    homeAttack: number;
    homeDefence: number;
    awayAttack: number;
    awayDefence: number;
  };
  method: "recent-form-goals-poisson" | "pitchapi-recent-xg-poisson";
  note: string;
}

function average(values: number[]): number {
  if (!values.length) throw new Error("Brak wyników do obliczenia średniej");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function predictFromRecentForm(home: TeamForm, away: TeamForm): FormPrediction {
  if (home.matches.length < 3 || away.matches.length < 3) {
    throw new Error("Za mało historii: wymagane są co najmniej 3 wcześniejsze mecze każdej drużyny.");
  }
  const homeAttackRows = home.home.length >= 2 ? home.home : home.matches;
  const homeDefenceRows = home.home.length >= 2 ? home.home : home.matches;
  const awayAttackRows = away.away.length >= 2 ? away.away : away.matches;
  const awayDefenceRows = away.away.length >= 2 ? away.away : away.matches;

  const homeAttack = average(homeAttackRows.map(match => match.goalsFor));
  const homeDefence = average(homeDefenceRows.map(match => match.goalsAgainst));
  const awayAttack = average(awayAttackRows.map(match => match.goalsFor));
  const awayDefence = average(awayDefenceRows.map(match => match.goalsAgainst));

  const homeExpectedGoals = clamp((homeAttack + awayDefence) / 2, 0.15, 4.5);
  const awayExpectedGoals = clamp((awayAttack + homeDefence) / 2, 0.15, 4.5);
  const prediction = predictFromExpectedGoals({ homeExpectedGoals, awayExpectedGoals });
  const ranked = [
    { pick: "1" as const, probability: prediction.probabilities.home },
    { pick: "X" as const, probability: prediction.probabilities.draw },
    { pick: "2" as const, probability: prediction.probabilities.away },
  ].sort((a, b) => b.probability - a.probability);
  return {
    prediction,
    pick: ranked[0].pick,
    topProbability: ranked[0].probability,
    strongCandidate: false,
    samples: {
      homeAttack: homeAttackRows.length,
      homeDefence: homeDefenceRows.length,
      awayAttack: awayAttackRows.length,
      awayDefence: awayDefenceRows.length,
    },
    method: "recent-form-goals-poisson",
    note: "Bazowy model Poissona z ostatnich bramek. λ jest estymatą z goli, NIE xG. Brak potwierdzonych składów, absencji, taktyki, pełnych statystyk i kursów — prawdopodobieństwa nie są zweryfikowane ani kwalifikowane jako mocny typ.",
  };
}

/** A separate, source-consistent model using only observed PitchAPI xG from prior completed matches. */
export function predictFromPitchApiXgForm(home: PitchApiXgForm, away: PitchApiXgForm): FormPrediction {
  if (home.matches.length < 3 || away.matches.length < 3
    || home.xgForPerMatch == null || home.xgAgainstPerMatch == null
    || away.xgForPerMatch == null || away.xgAgainstPerMatch == null) {
    throw new Error("Za mało zweryfikowanej historii xG PitchAPI: wymagane są co najmniej 3 mecze z xG każdej drużyny.");
  }
  const homeRows = home.matches.filter(row => row.isHome);
  const awayRows = away.matches.filter(row => !row.isHome);
  const homeSample = homeRows.length >= 2 ? homeRows : home.matches;
  const awaySample = awayRows.length >= 2 ? awayRows : away.matches;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const homeAttack = mean(homeSample.map(row => row.xgFor));
  const homeDefence = mean(homeSample.map(row => row.xgAgainst));
  const awayAttack = mean(awaySample.map(row => row.xgFor));
  const awayDefence = mean(awaySample.map(row => row.xgAgainst));
  const homeExpectedGoals = clamp((homeAttack + awayDefence) / 2, 0.15, 4.5);
  const awayExpectedGoals = clamp((awayAttack + homeDefence) / 2, 0.15, 4.5);
  const prediction = predictFromExpectedGoals({ homeExpectedGoals, awayExpectedGoals });
  const ranked = [
    { pick: "1" as const, probability: prediction.probabilities.home },
    { pick: "X" as const, probability: prediction.probabilities.draw },
    { pick: "2" as const, probability: prediction.probabilities.away },
  ].sort((a, b) => b.probability - a.probability);
  return {
    prediction, pick: ranked[0].pick, topProbability: ranked[0].probability,
    strongCandidate: false,
    samples: { homeAttack: homeSample.length, homeDefence: homeSample.length, awayAttack: awaySample.length, awayDefence: awaySample.length },
    method: "pitchapi-recent-xg-poisson",
    note: "Model oparty na średnim xG/xGA z wcześniejszych zakończonych meczów PitchAPI. Nie jest jeszcze skalibrowany out-of-sample; nie stanowi samodzielnego potwierdzenia mocnego typu.",
  };
}
