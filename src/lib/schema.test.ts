import { describe, expect, it } from "vitest";
import { COLUMNS } from "./schema";

describe("statistics read columns", () => {
  it("includes stored prediction stake and profit/loss fields", () => {
    expect(COLUMNS.predictions).toEqual(expect.arrayContaining(["stake", "potential_return", "profit_loss"]));
  });

  it("includes the canonical coupon-leg match link", () => {
    expect(COLUMNS.coupon_legs).toContain("match_id");
  });
});
