import type { TrackerRecord } from "./tracker-store";

/** Rebuilt virtual bankroll seed carried forward from the user's last confirmed Moneyball balance. */
export const DEFAULT_OPENING_BANKROLL_EUR = 91.60;

export interface BankrollSnapshot {
  openingBalance: number;
  settledProfitLoss: number;
  openExposure: number;
  availableBalance: number;
  selectedBets: number;
  settledBets: number;
  openBets: number;
  selectedCoupons: number;
  settledCoupons: number;
  openCoupons: number;
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function newestByParent(records: TrackerRecord[], kind: "bet" | "coupon", parentField: "parentBetId" | "parentCouponId", statuses: string[]): Map<string, TrackerRecord> {
  const latest = new Map<string, TrackerRecord>();
  for (const row of records) {
    const parent = row.details[parentField];
    if (row.kind !== kind || typeof parent !== "string" || !statuses.includes(row.status)) continue;
    const previous = latest.get(parent);
    if (!previous || Date.parse(row.createdAt) > Date.parse(previous.createdAt)) latest.set(parent, row);
  }
  return latest;
}

export function calculateBankroll(
  records: TrackerRecord[],
  fallbackOpeningBalance = DEFAULT_OPENING_BANKROLL_EUR,
): BankrollSnapshot {
  const openingRows = records
    .filter(row => row.kind === "ledger" && row.status === "OPENING_BALANCE"
      && row.details.event === "OPENING_BALANCE" && validAmount(row.details.amount))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const openingBalance = openingRows.length ? Number(openingRows[0].details.amount)
    : validAmount(fallbackOpeningBalance) ? fallbackOpeningBalance : 0;

  const bets = records.filter(row => row.kind === "bet"
    && row.details.decision === "SELECTED" && typeof row.details.parentBetId !== "string");
  const betSettlements = newestByParent(records, "bet", "parentBetId", ["WON", "LOST", "VOID"]);
  const couponSettlements = newestByParent(records, "coupon", "parentCouponId", ["PAPER_HIT", "PAPER_MISS"]);
  const coupons = records.filter(row => row.kind === "coupon" && row.status === "PAPER_WITH_ODDS"
    && typeof row.details.parentCouponId !== "string");

  let settledProfitLoss = 0;
  let openExposure = 0;
  let settledBets = 0;
  let openBets = 0;
  let settledCoupons = 0;
  let openCoupons = 0;

  for (const bet of bets) {
    const settlement = betSettlements.get(bet.id);
    if (settlement) {
      settledBets++;
      const pnl = settlement.details.profitLoss;
      if (typeof pnl === "number" && Number.isFinite(pnl)) settledProfitLoss += pnl;
    } else {
      openBets++;
      const stake = bet.details.stake;
      if (typeof stake === "number" && Number.isFinite(stake) && stake > 0) openExposure += stake;
    }
  }

  // Only a real, priced parent coupon can affect the bankroll. Orphan settlement
  // rows and settlements of PAPER_NO_ODDS coupons must never change the balance.
  for (const coupon of coupons) {
    const stake = coupon.details.stake;
    const odds = coupon.details.odds;
    const priced = typeof stake === "number" && Number.isFinite(stake) && stake > 0
      && typeof odds === "number" && Number.isFinite(odds) && odds > 1;
    if (!priced) continue;
    const settlement = couponSettlements.get(coupon.id);
    if (settlement) {
      settledCoupons++;
      const pnl = settlement.details.profitLoss;
      if (typeof pnl === "number" && Number.isFinite(pnl)) settledProfitLoss += pnl;
    } else {
      openCoupons++;
      openExposure += stake;
    }
  }

  return {
    openingBalance,
    settledProfitLoss,
    openExposure,
    availableBalance: openingBalance + settledProfitLoss - openExposure,
    selectedBets: bets.length,
    settledBets,
    openBets,
    selectedCoupons: coupons.length,
    settledCoupons,
    openCoupons,
  };
}

export function canReserveStake(records: TrackerRecord[], stake: number, fallbackOpeningBalance = DEFAULT_OPENING_BANKROLL_EUR): boolean {
  if (!Number.isFinite(stake) || stake <= 0) return false;
  const bankroll = calculateBankroll(records, fallbackOpeningBalance);
  return stake <= bankroll.availableBalance + 1e-9;
}
