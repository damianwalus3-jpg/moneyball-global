import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
  clearConfig,
  readConfig,
  saveConfig,
} from "./config";

describe("default Supabase connection", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    localStorage.clear();
  });

  afterEach(() => {
    clearConfig();
    vi.unstubAllEnvs();
  });

  it("uses the built-in public key for the isolated MONEYBALL test project", () => {
    expect(readConfig()).toEqual({
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
      source: "default",
    });
  });

  it("prefers a saved public key override", () => {
    saveConfig({ url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY });
    expect(readConfig()?.source).toBe("local");
  });

  it("returns to the built-in key after clearing the saved override", () => {
    saveConfig({ url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY });
    clearConfig();
    expect(readConfig()?.source).toBe("default");
  });
});
