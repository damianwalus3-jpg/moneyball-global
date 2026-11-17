import { describe, expect, it } from "vitest";
import { seasonCode, seasonStartYear } from "./season";

describe("European season boundaries", () => {
  it("uses the current calendar year from July onward", () => {
    expect(seasonStartYear("2026-07-01")).toBe(2026);
    expect(seasonCode("2026-11-17")).toBe("2627");
  });
  it("uses the previous start year before July", () => {
    expect(seasonStartYear("2027-02-01")).toBe(2026);
    expect(seasonCode("2027-02-01")).toBe("2627");
  });
  it("rejects invalid dates", () => {
    expect(() => seasonCode("2026-13-01")).toThrow();
  });
});
