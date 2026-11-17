import { describe, expect, it } from "vitest";
import { getCouponSourceClass, shouldRecordCouponStake } from "./coupons";

describe("coupon finance source classification", () => {
  it("classifies TEST coupons as PAPER and model coupon sections as MODEL", () => {
    expect(getCouponSourceClass("TEST")).toBe("PAPER");
    expect(getCouponSourceClass("MAIN")).toBe("MODEL");
    expect(getCouponSourceClass("MEGA")).toBe("MODEL");
    expect(getCouponSourceClass("EXTRA")).toBe("MODEL");
  });

  it("never records PAPER stakes in the official bankroll ledger", () => {
    expect(shouldRecordCouponStake("TEST", true)).toBe(false);
    expect(shouldRecordCouponStake("TEST", false)).toBe(false);
    expect(shouldRecordCouponStake("MAIN", true)).toBe(true);
    expect(shouldRecordCouponStake("MEGA", true)).toBe(true);
    expect(shouldRecordCouponStake("EXTRA", true)).toBe(true);
    expect(shouldRecordCouponStake("MAIN", false)).toBe(false);
  });
});
