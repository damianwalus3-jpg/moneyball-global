import { isEligibleResultsSyncMatch } from "./results-sync-scope.ts";

const base = {
  country: "England", competition: "Premier League", league: "Premier League",
  gender: "men", home_team: "Arsenal", away_team: "Chelsea",
  source: "FootyNomad", external_id: "fn:eng-premier-league-2026-11-18-arsenal-chelsea",
};

Deno.test("results sync accepts only European men's domestic tiers one and two", () => {
  if (!isEligibleResultsSyncMatch(base)) throw new Error("Top-flight men's league should be eligible.");
  if (isEligibleResultsSyncMatch({ ...base, competition: "National League North" })) throw new Error("Tier three must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, competition: "FA Cup" })) throw new Error("Domestic cups must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, competition: "Women's Super League", gender: "women" })) throw new Error("Women's leagues must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, home_team: "Arsenal U21" })) throw new Error("Youth teams must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, country: "Brazil" })) throw new Error("Non-European countries must be excluded.");
});

Deno.test("results sync honors explicit OpenMatchday tier folders", () => {
  if (!isEligibleResultsSyncMatch({ ...base, source: "OpenMatchday", external_id: "ENG_2_2026-27_01" })) throw new Error("OpenMatchday tier two should be eligible.");
  if (isEligibleResultsSyncMatch({ ...base, source: "OpenMatchday", external_id: "ENG_3_2026-27_01" })) throw new Error("OpenMatchday tier three must be excluded.");
});
