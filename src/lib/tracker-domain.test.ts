import { describe, expect, it } from "vitest";
import {
  formatJackpotSequence,
  normalizeTrackerDecision,
  normalizeTrackerSettlement,
  normalizeTrackerSourceClass,
  resolveTrackerCategory,
} from "./tracker-domain";

describe("Tracker legacy normalization", () => {
  it("keeps MAIN separate from MAIN A and MAIN B", () => {
    expect(resolveTrackerCategory("MAIN")).toBe("LEGACY_MAIN");
    expect(resolveTrackerCategory("MAIN A")).toBe("MAIN_A");
    expect(resolveTrackerCategory("MAIN B")).toBe("MAIN_B");
  });

  it("normalizes known category labels and preserves unknown labels as unknown", () => {
    expect(resolveTrackerCategory("  market data / test ")).toBe("LEGACY_MARKET_DATA_TEST");
    expect(resolveTrackerCategory("MEGA")).toBe("MEGA");
    expect(resolveTrackerCategory("some new label")).toBe("UNKNOWN");
    expect(resolveTrackerCategory(null)).toBe("UNKNOWN");
  });

  it("maps only explicit legacy decision states", () => {
    expect(normalizeTrackerDecision("WYBRANY")).toBe("FINAL");
    expect(normalizeTrackerDecision("ODRZUCONY")).toBe("REJECTED");
    expect(normalizeTrackerDecision("WSTĘPNY")).toBe("PRELIMINARY");
    expect(normalizeTrackerDecision("BRAK DANYCH")).toBe("NO_DATA");
    expect(normalizeTrackerDecision("unknown")).toBe("UNKNOWN");
  });

  it("normalizes settlement independently from decision status", () => {
    expect(normalizeTrackerSettlement("won")).toBe("WIN");
    expect(normalizeTrackerSettlement("lost")).toBe("LOSS");
    expect(normalizeTrackerSettlement("pending")).toBe("PENDING");
    expect(normalizeTrackerDecision("WYBRANY")).not.toBe(normalizeTrackerSettlement("won"));
  });

  it("does not guess missing source classification", () => {
    expect(normalizeTrackerSourceClass(null)).toBe("UNCLASSIFIED");
    expect(normalizeTrackerSourceClass("MODEL")).toBe("MODEL");
    expect(normalizeTrackerSourceClass("PAPER")).toBe("PAPER");
  });

  it("formats stable jackpot sequence labels and rejects invalid values", () => {
    expect(formatJackpotSequence(1)).toBe("#001");
    expect(formatJackpotSequence(12)).toBe("#012");
    expect(formatJackpotSequence(1000)).toBe("#1000");
    expect(() => formatJackpotSequence(0)).toThrow();
  });
});
