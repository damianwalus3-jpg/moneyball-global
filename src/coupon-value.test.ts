import { describe, expect, it } from "vitest";
import type { TrackerRecord } from "./tracker-store";
import type { ThreeLegCandidate } from "./coupon-engine";
import { valueThreeLegCoupon } from "./coupon-value";
import { canonicalFixtureId } from "./free-fixtures";

const now = "2026-11-17T20:00:00.000Z";
const candidate: ThreeLegCandidate = {
  date: "2026-11-17", combinedProbability: 0.512, averageProbability: 0.8, oddsAvailable: false,
  legs: [
    { fixtureId: "f1", title: "A vs B", competition: "League", selection: "1", market: "1X2", probability: 0.8, source: "model", model: "v1" },
    { fixtureId: "f2", title: "C vs D", competition: "League", selection: "X", market: "1X2", probability: 0.8, source: "model", model: "v1" },
    { fixtureId: "f3", title: "E vs F", competition: "League", selection: "2", market: "1X2", probability: 0.8, source: "model", model: "v1" },
  ],
};
function row(kind: "prediction" | "odds", fixtureId: string, details: Record<string, string | number | boolean | null>, status: string): TrackerRecord {
  return { id: kind + fixtureId, kind, title: fixtureId, status, createdAt: now, details: { fixtureId, ...details } };
}
function fullRecords(): TrackerRecord[] {
  const predictions = [
    row("prediction", "f1", { p1: 0.8, px: 0.1, p2: 0.1, selection: "1", strongCandidate: true }, "KANDYDAT"),
    row("prediction", "f2", { p1: 0.1, px: 0.8, p2: 0.1, selection: "X", strongCandidate: true }, "KANDYDAT"),
    row("prediction", "f3", { p1: 0.1, px: 0.1, p2: 0.8, selection: "2", strongCandidate: true }, "KANDYDAT"),
  ];
  const odds = ["f1", "f2", "f3"].map(id => row("odds", id, {
    bookmaker: "Book A", market: "1X2", complete1X2: true,
    odds1: 2.2, oddsX: 2.2, odds2: 2.2, capturedAt: "2026-11-17T19:30:00.000Z",
  }, "COMPLETE_1X2"));
  return [...predictions, ...odds];
}

describe("three-leg coupon odds valuation", () => {
  it("calculates combined odds, expected value and €4 paper return", () => {
    const value = valueThreeLegCoupon(candidate, fullRecords(), "Book A", now);
    expect(value?.combinedOdds).toBeCloseTo(2.2 ** 3);
    expect(value?.expectedValue).toBeCloseTo(0.512 * 2.2 ** 3 - 1);
    expect(value?.stake).toBe(4);
    expect(value?.potentialReturn).toBeCloseTo(4 * 2.2 ** 3);
    expect(value?.potentialProfit).toBeCloseTo(4 * (2.2 ** 3 - 1));
  });

  it("requires every leg to have fresh odds from the same bookmaker", () => {
    const records = fullRecords().filter(row => row.details.fixtureId !== "f3" || row.kind !== "odds");
    expect(valueThreeLegCoupon(candidate, records, "Book A", now)).toBeNull();
    expect(valueThreeLegCoupon(candidate, fullRecords(), "Other Book", now)).toBeNull();
  });

  it("refuses pricing when a newer prediction has been rejected", () => {
    const rejected = row("prediction", "f1", {
      p1: 0.8, px: 0.1, p2: 0.1, selection: "1", strongCandidate: false,
    }, "ODRZUCONY");
    const records = [...fullRecords(), { ...rejected, createdAt: "2026-11-17T20:00:01.000Z" }];
    expect(valueThreeLegCoupon(candidate, records, "Book A", now)).toBeNull();
  });

  it("refuses pricing when the current probabilities no longer match the coupon", () => {
    const records = fullRecords().map(record => record.kind === "prediction" && record.details.fixtureId === "f1"
      ? { ...record, details: { ...record.details, p1: 0.79, px: 0.11, p2: 0.1 } }
      : record);
    expect(valueThreeLegCoupon(candidate, records, "Book A", now)).toBeNull();
  });

  it("prices three direct Double Chance legs from the same bookmaker", () => {
    const dcCandidate: ThreeLegCandidate = {
      date: "2026-11-17", combinedProbability: 0.612, averageProbability: 0.85, oddsAvailable: false,
      legs: [
        { fixtureId: "f1", title: "A vs B", competition: "League", selection: "1X", market: "DOUBLE_CHANCE", probability: 0.9, source: "model", model: "v1" },
        { fixtureId: "f2", title: "C vs D", competition: "League", selection: "X2", market: "DOUBLE_CHANCE", probability: 0.85, source: "model", model: "v1" },
        { fixtureId: "f3", title: "E vs F", competition: "League", selection: "12", market: "DOUBLE_CHANCE", probability: 0.8, source: "model", model: "v1" },
      ],
    };
    const predictions = [
      row("prediction", "f1", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.9, px2: 0.6, p12: 0.5, selection: "1X", probability: 0.9, strongDoubleChance: true }, "KANDYDAT"),
      row("prediction", "f2", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.6, px2: 0.85, p12: 0.55, selection: "X2", probability: 0.85, strongDoubleChance: true }, "KANDYDAT"),
      row("prediction", "f3", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.6, px2: 0.6, p12: 0.8, selection: "12", probability: 0.8, strongDoubleChance: true }, "KANDYDAT"),
    ];
    const prices = ["f1", "f2", "f3"].map(id => row("odds", id, {
      bookmaker: "Book A", market: "DOUBLE_CHANCE", completeDoubleChance: true,
      odds1x: 1.25, oddsX2: 1.3, odds12: 1.35, capturedAt: "2026-11-17T19:30:00.000Z",
    }, "COMPLETE_DOUBLE_CHANCE"));
    const value = valueThreeLegCoupon(dcCandidate, [...predictions, ...prices], "Book A", now);
    expect(value?.combinedOdds).toBeCloseTo(1.25 * 1.3 * 1.35);
    expect(value?.combinedProbability).toBeCloseTo(0.612);
    expect(value?.expectedValue).toBeCloseTo(0.612 * 1.25 * 1.3 * 1.35 - 1);
    expect(value?.legs.every(leg => leg.market === "DOUBLE_CHANCE" && leg.marketProbabilityNoVig === null)).toBe(true);
  });

  it("does not price a Double Chance leg from 1X2 quotes or a rejected DC prediction", () => {
    const dcCandidate: ThreeLegCandidate = {
      date: "2026-11-17", combinedProbability: 0.544, averageProbability: 0.8166666667, oddsAvailable: false,
      legs: [
        { fixtureId: "f1", title: "A vs B", competition: "League", selection: "1X", market: "DOUBLE_CHANCE", probability: 0.8, source: "model", model: "v1" },
        { fixtureId: "f2", title: "C vs D", competition: "League", selection: "X2", market: "DOUBLE_CHANCE", probability: 0.85, source: "model", model: "v1" },
        { fixtureId: "f3", title: "E vs F", competition: "League", selection: "12", market: "DOUBLE_CHANCE", probability: 0.8, source: "model", model: "v1" },
      ],
    };
    const dcPredictions = [
      row("prediction", "f1", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.8, px2: 0.7, p12: 0.5, selection: "1X", probability: 0.8, strongDoubleChance: true }, "KANDYDAT"),
      row("prediction", "f2", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.6, px2: 0.85, p12: 0.55, selection: "X2", probability: 0.85, strongDoubleChance: true }, "KANDYDAT"),
      row("prediction", "f3", { market: "DOUBLE_CHANCE", model: "v1", p1x: 0.6, px2: 0.6, p12: 0.8, selection: "12", probability: 0.8, strongDoubleChance: true }, "KANDYDAT"),
    ];
    const rejected = { ...dcPredictions[0], status: "ODRZUCONY", details: { ...dcPredictions[0].details, strongDoubleChance: false } };
    expect(valueThreeLegCoupon(dcCandidate, [...dcPredictions, ...fullRecords().filter(r => r.kind === "odds")], "Book A", now)).toBeNull();
    expect(valueThreeLegCoupon(dcCandidate, [rejected, ...dcPredictions.slice(1), ...fullRecords().filter(r => r.kind === "odds")], "Book A", now)).toBeNull();
  });
  it("prices a DC coupon when prediction and odds records have different provider IDs", () => {
    const date = "2026-11-17";
    const teams = [["A", "B"], ["C", "D"], ["E", "F"]] as const;
    const fixtureIds = teams.map(([home, away]) => canonicalFixtureId(date, home, away, "League"));
    const selections = ["1X", "X2", "12"] as const;
    const probs = [
      { p1x: 0.9, px2: 0.6, p12: 0.5 },
      { p1x: 0.6, px2: 0.85, p12: 0.55 },
      { p1x: 0.6, px2: 0.6, p12: 0.8 },
    ];
    const selected = [0.9, 0.85, 0.8];
    const candidate: ThreeLegCandidate = {
      date, combinedProbability: 0.612, averageProbability: 0.85, oddsAvailable: false,
      legs: fixtureIds.map((fixtureId, index) => ({
        fixtureId, title: `${teams[index][0]} vs ${teams[index][1]}`, competition: "League",
        selection: selections[index], market: "DOUBLE_CHANCE", probability: selected[index],
        source: "model", model: "v1",
      })) as ThreeLegCandidate["legs"],
    };
    const withTeams = (record: TrackerRecord, index: number): TrackerRecord => ({
      ...record, title: `${date} · ${teams[index][0]} vs ${teams[index][1]}`,
      details: { ...record.details, fixtureDate: date, home: teams[index][0], away: teams[index][1], competition: "League" },
    });
    const predictions = fixtureIds.map((_, index) => withTeams(row("prediction", `prediction-provider-${index}`, {
      market: "DOUBLE_CHANCE", model: "v1", ...probs[index],
      selection: selections[index], probability: selected[index], strongDoubleChance: true,
    }, "KANDYDAT"), index));
    const prices = fixtureIds.map((_, index) => withTeams(row("odds", `odds-provider-${index}`, {
      bookmaker: "Book A", market: "DOUBLE_CHANCE", completeDoubleChance: true,
      odds1x: 1.25, oddsX2: 1.3, odds12: 1.35, capturedAt: "2026-11-17T19:30:00.000Z",
    }, "COMPLETE_DOUBLE_CHANCE"), index));
    const value = valueThreeLegCoupon(candidate, [...predictions, ...prices], "Book A", now);
    expect(value?.combinedOdds).toBeCloseTo(1.25 * 1.3 * 1.35);
    expect(value?.combinedProbability).toBeCloseTo(0.612);
  });
  it("rejects invalid stake and stale price data", () => {
    expect(valueThreeLegCoupon(candidate, fullRecords(), "Book A", now, 360, 0)).toBeNull();
    const stale = fullRecords().map(row => row.kind === "odds"
      ? { ...row, details: { ...row.details, capturedAt: "2026-11-17T10:00:00.000Z" } }
      : row);
    expect(valueThreeLegCoupon(candidate, stale, "Book A", now)).toBeNull();
    const justOverHour = fullRecords().map(row => row.kind === "odds"
      ? { ...row, details: { ...row.details, capturedAt: "2026-11-17T18:59:00.000Z" } }
      : row);
    expect(valueThreeLegCoupon(candidate, justOverHour, "Book A", now)).toBeNull();
  });
});
