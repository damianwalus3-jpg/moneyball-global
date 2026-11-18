import { isRealXgObservation } from "./xg-validation.ts";

Deno.test("xG requires real xG values and an explicit xG source", () => {
  if (!isRealXgObservation({xg_for:1.2,xg_against:0.8,source:"OpenPlay"})) throw new Error("Expected sourced xG");
  if (isRealXgObservation({xg_for:2,xg_against:1,source:""})) throw new Error("Missing source was accepted");
  if (isRealXgObservation({xg_for:2,xg_against:1,source:"historical_xg"})) throw new Error("Synthetic fallback source was accepted");
  if (isRealXgObservation({xg_for:2,xg_against:null,source:"OpenPlay"})) throw new Error("Missing xGA was accepted");
  if (isRealXgObservation({xg_for:-0.1,xg_against:0.8,source:"OpenPlay"})) throw new Error("Negative xG was accepted");
  if (isRealXgObservation({xg_for:"not-a-number",xg_against:0.8,source:"OpenPlay"})) throw new Error("Invalid xG was accepted");
});
