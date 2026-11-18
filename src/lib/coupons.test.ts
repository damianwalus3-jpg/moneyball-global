import { describe, expect, it } from "vitest";
import { getCouponSourceClass, shouldRecordCouponStake, validateNewCouponType } from "./coupons";

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

describe("new coupon type and leg-count guard", () => {
  it("keeps MAIN singles separate from three-leg MEGA/EXTRA AKO coupons", () => {
    expect(() => validateNewCouponType("MAIN", 1)).not.toThrow();
    expect(() => validateNewCouponType("MEGA", 3)).not.toThrow();
    expect(() => validateNewCouponType("EXTRA", 3)).not.toThrow();
    expect(() => validateNewCouponType("MAIN", 3)).toThrow();
    expect(() => validateNewCouponType("MEGA", 1)).toThrow();
  });

  it("rejects every new TEST coupon while historical TEST classification remains readable", () => {
    expect(() => validateNewCouponType("TEST", 1)).toThrow(/TEST coupons are disabled/);
    expect(() => validateNewCouponType("TEST", 3)).toThrow(/TEST coupons are disabled/);
    expect(getCouponSourceClass("TEST")).toBe("PAPER");
  });
});
