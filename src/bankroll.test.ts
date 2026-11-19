import { describe, expect, it } from "vitest";
import type { TrackerRecord } from "./tracker-store";
import { calculateBankroll, canReserveStake, DEFAULT_OPENING_BANKROLL_EUR } from "./bankroll";

function row(kind: TrackerRecord["kind"], status: string, details: TrackerRecord["details"], id: string): TrackerRecord {
  return { id, kind, status, title: id, createdAt: "2026-11-19T10:00:00.000Z", details };
}

describe("virtual bankroll protection", () => {
  it("starts from the last confirmed €91.60 virtual bankroll when no local ledger seed exists", () => {
    const value = calculateBankroll([]);
    expect(DEFAULT_OPENING_BANKROLL_EUR).toBe(91.60);
    expect(value.openingBalance).toBe(91.60);
    expect(value.availableBalance).toBe(91.60);
  });

  it("uses an explicit opening-balance ledger entry when one exists", () => {
    const ledger = row("ledger", "OPENING_BALANCE", { event: "OPENING_BALANCE", amount: 125 }, "opening");
    expect(calculateBankroll([ledger]).availableBalance).toBe(125);
  });

  it("reserves open selected stakes and prevents spending more than the available balance", () => {
    const bet = row("bet", "OPEN", { decision: "SELECTED", stake: 40 }, "bet-1");
    const value = calculateBankroll([bet]);
    expect(value.openExposure).toBe(40);
    expect(value.availableBalance).toBeCloseTo(51.60);
    expect(canReserveStake([bet], 51.60)).toBe(true);
    expect(canReserveStake([bet], 51.61)).toBe(false);
  });

  it("releases reserved stake on settlement and applies net profit/loss exactly once", () => {
    const bet = row("bet", "OPEN", { decision: "SELECTED", stake: 5 }, "bet-1");
    const won = row("bet", "WON", { parentBetId: "bet-1", profitLoss: 7.5 }, "settlement-1");
    const value = calculateBankroll([bet, won]);
    expect(value.openExposure).toBe(0);
    expect(value.settledProfitLoss).toBe(7.5);
    expect(value.availableBalance).toBeCloseTo(99.10);
    expect(value.settledBets).toBe(1);
    expect(value.openBets).toBe(0);
  });

  it("deducts a settled loss and treats void as zero net P/L", () => {
    const loss = row("bet", "LOST", { parentBetId: "bet-1", profitLoss: -5 }, "settlement-1");
    const voided = row("bet", "VOID", { parentBetId: "bet-2", profitLoss: 0 }, "settlement-2");
    const bets = [
      row("bet", "OPEN", { decision: "SELECTED", stake: 5 }, "bet-1"),
      row("bet", "OPEN", { decision: "SELECTED", stake: 10 }, "bet-2"),
    ];
    const value = calculateBankroll([...bets, loss, voided]);
    expect(value.availableBalance).toBeCloseTo(86.60);
    expect(value.settledBets).toBe(2);
  });

  it("reserves priced paper coupons and applies their settled P/L", () => {
    const coupon = row("coupon", "PAPER_WITH_ODDS", { stake: 4, odds: 2.5 }, "coupon-1");
    const open = calculateBankroll([coupon]);
    expect(open.openExposure).toBe(4);
    expect(open.availableBalance).toBeCloseTo(87.60);
    expect(open.openCoupons).toBe(1);
    expect(canReserveStake([coupon], 87.60)).toBe(true);
    expect(canReserveStake([coupon], 87.61)).toBe(false);
    const hit = row("coupon", "PAPER_HIT", { parentCouponId: "coupon-1", stake: 4, odds: 2.5, profitLoss: 6 }, "coupon-settlement");
    const settled = calculateBankroll([coupon, hit]);
    expect(settled.openExposure).toBe(0);
    expect(settled.settledProfitLoss).toBe(6);
    expect(settled.availableBalance).toBeCloseTo(97.60);
    expect(settled.settledCoupons).toBe(1);
  });

  it("ignores rejected paper decisions and rejects invalid stakes", () => {
    const rejected = row("bet", "ODRZUCONY", { decision: "REJECTED", stake: 0 }, "rejected");
    expect(calculateBankroll([rejected]).availableBalance).toBe(91.60);
    expect(canReserveStake([], 0)).toBe(false);
    expect(canReserveStake([], Number.NaN)).toBe(false);
    expect(canReserveStake([], 91.61)).toBe(false);
  });
});
