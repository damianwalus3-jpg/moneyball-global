import { deriveDoubleChance, type OneXTwo } from "./domain";

export interface ExpectedGoalsInput {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  maxGoals?: number;
}
export interface PoissonPrediction {
  probabilities: OneXTwo;
  doubleChance: ReturnType<typeof deriveDoubleChance>;
  expectedGoals: { home: number; away: number; total: number };
  method: "independent-poisson";
  maxGoals: number;
  confidence: number;
}
function poissonDistribution(lambda: number, maxGoals: number): number[] {
  const values = [Math.exp(-lambda)];
  for (let goals = 1; goals <= maxGoals; goals++) values.push(values[goals - 1] * lambda / goals);
  return values;
}
export function predictFromExpectedGoals(input: ExpectedGoalsInput): PoissonPrediction {
  const home = input.homeExpectedGoals;
  const away = input.awayExpectedGoals;
  const maxGoals = input.maxGoals ?? 10;
  if (![home, away].every(value => Number.isFinite(value) && value >= 0 && value <= 8)) {
    throw new Error("Expected goals must be finite values between 0 and 8");
  }
  if (!Number.isInteger(maxGoals) || maxGoals < 6 || maxGoals > 15) {
    throw new Error("maxGoals must be an integer between 6 and 15");
  }
  const homeDist = poissonDistribution(home, maxGoals);
  const awayDist = poissonDistribution(away, maxGoals);
  let pHome = 0, pDraw = 0, pAway = 0, capturedMass = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const probability = homeDist[h] * awayDist[a];
      capturedMass += probability;
      if (h > a) pHome += probability;
      else if (h === a) pDraw += probability;
      else pAway += probability;
    }
  }
  // Renormalize the truncated score matrix so the output is a valid distribution.
  const probabilities = { home: pHome / capturedMass, draw: pDraw / capturedMass, away: pAway / capturedMass };
  const ordered = Object.values(probabilities).sort((a, b) => b - a);
  return {
    probabilities,
    doubleChance: deriveDoubleChance(probabilities),
    expectedGoals: { home, away, total: home + away },
    method: "independent-poisson",
    maxGoals,
    confidence: ordered[0] - ordered[1],
  };
}

export interface SettledPrediction {
  probabilities: OneXTwo;
  actual: "1" | "X" | "2";
}
export interface PredictionMetrics {
  count: number;
  brierScore: number;
  logLoss: number;
  accuracy: number;
}
export function evaluatePredictions(rows: SettledPrediction[]): PredictionMetrics | null {
  if (!rows.length) return null;
  let brier = 0, logLoss = 0, correct = 0;
  for (const row of rows) {
    const p = row.probabilities;
    const sum = p.home + p.draw + p.away;
    if (![p.home, p.draw, p.away].every(value => Number.isFinite(value) && value >= 0 && value <= 1) || Math.abs(sum - 1) > 0.0001) {
      throw new Error("Invalid probability distribution in settled prediction");
    }
    const actualIndex = row.actual === "1" ? 0 : row.actual === "X" ? 1 : 2;
    const values = [p.home, p.draw, p.away];
    brier += values.reduce((total, value, index) => total + (value - (index === actualIndex ? 1 : 0)) ** 2, 0) / 3;
    logLoss -= Math.log(Math.max(values[actualIndex], 1e-15));
    if (values[actualIndex] === Math.max(...values)) correct++;
  }
  return { count: rows.length, brierScore: brier / rows.length, logLoss: logLoss / rows.length, accuracy: correct / rows.length };
}
