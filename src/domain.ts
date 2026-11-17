export type Market = "1X2" | "DOUBLE_CHANCE" | "GOALS";
export type Selection = "1" | "X" | "2" | "1X" | "X2" | "12" | "OVER_15" | "OVER_25" | "UNDER_25" | "BTTS_YES" | "BTTS_NO";

export interface Fixture {
  id: string;
  provider: string;
  providerFixtureId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
}

export interface ThreeLegInput {
  fixtureId: string;
  selection: Selection;
  odds: number;
}

export interface CouponQuote {
  legCount: 3;
  totalOdds: number;
  stake: number;
  grossReturn: number;
  netProfit: number;
}

export interface OneXTwo {
  home: number;
  draw: number;
  away: number;
}

export function validateOneXTwo(probabilities: OneXTwo, tolerance = 0.0001): boolean {
  const values = [probabilities.home, probabilities.draw, probabilities.away];
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1)) return false;
  return Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= tolerance;
}

export function deriveDoubleChance(probabilities: OneXTwo) {
  if (!validateOneXTwo(probabilities)) throw new Error("Invalid 1X2 probability distribution");
  return {
    oneX: probabilities.home + probabilities.draw,
    xTwo: probabilities.draw + probabilities.away,
    oneTwo: probabilities.home + probabilities.away,
  };
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
}

export function fixtureFingerprint(fixture: Pick<Fixture, "competitionId" | "homeTeamId" | "awayTeamId" | "kickoffUtc">): string {
  const kickoff = new Date(fixture.kickoffUtc);
  if (Number.isNaN(kickoff.getTime())) throw new Error("Invalid kickoff timestamp");
  return [normalize(fixture.competitionId), normalize(fixture.homeTeamId), normalize(fixture.awayTeamId), kickoff.toISOString()].join("|");
}

export function deduplicateFixtures(fixtures: Fixture[]): Fixture[] {
  const providerIds = new Set<string>();
  const fingerprints = new Set<string>();
  const result: Fixture[] = [];
  for (const fixture of fixtures) {
    const providerKey = `${normalize(fixture.provider)}|${normalize(fixture.providerFixtureId)}`;
    const fingerprint = fixtureFingerprint(fixture);
    if (providerIds.has(providerKey) || fingerprints.has(fingerprint)) continue;
    providerIds.add(providerKey);
    fingerprints.add(fingerprint);
    result.push(fixture);
  }
  return result;
}

export function quoteThreeLegCoupon(legs: ThreeLegInput[], stake: number): CouponQuote {
  if (legs.length !== 3) throw new Error("A standard coupon must contain exactly three legs");
  if (new Set(legs.map(leg => leg.fixtureId)).size !== 3) throw new Error("A fixture can appear only once per coupon");
  if (!Number.isFinite(stake) || stake <= 0) throw new Error("Stake must be greater than zero");
  if (legs.some(leg => !Number.isFinite(leg.odds) || leg.odds <= 1)) throw new Error("Every leg must have decimal odds greater than 1.00");
  const totalOdds = legs.reduce((product, leg) => product * leg.odds, 1);
  const grossReturn = stake * totalOdds;
  return { legCount: 3, totalOdds, stake, grossReturn, netProfit: grossReturn - stake };
}
