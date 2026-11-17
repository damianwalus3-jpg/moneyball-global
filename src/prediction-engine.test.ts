import { describe, expect, it } from "vitest";
import { evaluatePredictions, predictFromExpectedGoals } from "./prediction-engine";

describe("transparent Poisson prediction engine", () => {
  it("produces normalized 1X2 and separately derived Double Chance", () => {
    const result = predictFromExpectedGoals({ homeExpectedGoals: 1.7, awayExpectedGoals: 0.9 });
    expect(result.probabilities.home + result.probabilities.draw + result.probabilities.away).toBeCloseTo(1, 10);
    expect(result.doubleChance.oneX).toBeCloseTo(result.probabilities.home + result.probabilities.draw);
    expect(result.method).toBe("independent-poisson");
  });
  it("responds sensibly to a stronger home expected-goals input", () => {
    const balanced = predictFromExpectedGoals({ homeExpectedGoals: 1.2, awayExpectedGoals: 1.2 });
    const homeStrong = predictFromExpectedGoals({ homeExpectedGoals: 2.2, awayExpectedGoals: 0.8 });
    expect(homeStrong.probabilities.home).toBeGreaterThan(balanced.probabilities.home);
  });
  it("rejects missing, non-finite or implausible expected goals", () => {
    expect(() => predictFromExpectedGoals({ homeExpectedGoals: -1, awayExpectedGoals: 1 })).toThrow();
    expect(() => predictFromExpectedGoals({ homeExpectedGoals: 1, awayExpectedGoals: 9 })).toThrow();
    expect(() => predictFromExpectedGoals({ homeExpectedGoals: 1, awayExpectedGoals: 1, maxGoals: 3 })).toThrow();
  });
  it("calculates Brier score, log loss and accuracy from settled outcomes", () => {
    const metrics = evaluatePredictions([
      { probabilities: { home: 0.7, draw: 0.2, away: 0.1 }, actual: "1" },
      { probabilities: { home: 0.2, draw: 0.5, away: 0.3 }, actual: "2" },
    ]);
    expect(metrics?.count).toBe(2);
    expect(metrics?.accuracy).toBe(0.5);
    expect(metrics?.brierScore).toBeGreaterThan(0);
    expect(metrics?.logLoss).toBeGreaterThan(0);
    expect(evaluatePredictions([])).toBeNull();
  });
  it("rejects invalid probabilities during model evaluation", () => {
    expect(() => evaluatePredictions([{ probabilities: { home: 0.8, draw: 0.8, away: 0 }, actual: "1" }])).toThrow();
  });
});
