import { dedupeResultsSyncMatches, isEligibleResultsSyncMatch } from "./results-sync-scope.ts";

const base = {
  country: "England", competition: "Premier League", league: "Premier League",
  gender: "men", home_team: "Arsenal", away_team: "Chelsea",
  source: "FootyNomad", external_id: "fn:eng-premier-league-2026-11-18-arsenal-chelsea",
};

Deno.test("results sync accepts all European senior men's domestic league tiers", () => {
  if (!isEligibleResultsSyncMatch(base)) throw new Error("Top-flight men's league should be eligible.");
  for (const competition of ["National League - North","Third League - Northeast","Tercera División RFEF - Group 13","Oberliga - Hessen","Football League - Lowland League","III Liga - Group 3","1st League - RS"]) {
    if (!isEligibleResultsSyncMatch({ ...base, competition })) throw new Error("Senior domestic tier should be eligible: " + competition);
  }
  if (isEligibleResultsSyncMatch({ ...base, competition: "FA Cup" })) throw new Error("Domestic cups must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, competition: "Women's Super League", gender: "women" })) throw new Error("Women's leagues must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, home_team: "Arsenal U21" })) throw new Error("Youth teams must be excluded.");
  if (isEligibleResultsSyncMatch({ ...base, gender: "unknown" })) throw new Error("Unknown gender must not be settled as men.");
  if (!isEligibleResultsSyncMatch({ ...base, gender: null })) throw new Error("Missing gender is accepted only when league/team markers are clearly men.");
  if (isEligibleResultsSyncMatch({ ...base, country: "Brazil" })) throw new Error("Non-European countries must be excluded.");
});

Deno.test("results sync honors explicit OpenMatchday tier folders", () => {
  if (!isEligibleResultsSyncMatch({ ...base, source: "OpenMatchday", external_id: "om:ENG_2_2026-27:fixture-01" })) throw new Error("OpenMatchday tier two should be eligible.");
  if (isEligibleResultsSyncMatch({ ...base, source: "OpenMatchday", external_id: "om:ENG_3_2026-27:fixture-01" })) throw new Error("OpenMatchday tier three must be excluded.");
});

Deno.test("results sync deduplicates same Brussels date and ordered team pair", () => {
  const base = {
    country: "England", competition: "Premier League", gender: "men",
    home_team: "Arsenal FC", away_team: "Chelsea",
    kickoff_at: "2026-11-18T19:00:00Z", kickoff_date: "2026-11-18",
  };
  const rows = [
    { ...base, id: "a", source: "OpenMatchday", updated_at: "2026-11-18T07:00:00Z" },
    { ...base, id: "b", source: "FootyNomad", updated_at: "2026-11-18T06:00:00Z" },
    { ...base, id: "c", source: "FootyNomad", kickoff_at: "2026-11-19T00:00:00Z", updated_at: "2026-11-18T08:00:00Z" },
  ];
  const result = dedupeResultsSyncMatches(rows);
  if (result.length !== 2) throw new Error("Same Brussels-day pair should collapse; a different Brussels day must remain.");
  if (result.find((row) => row.id === "b") === undefined) throw new Error("FootyNomad should win source priority.");
});
