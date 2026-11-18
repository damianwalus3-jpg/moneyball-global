import { isExcludedSeniorTeam, normalizeTeamName, teamHistoryKey } from "./team-normalization.ts";

Deno.test("normalizes accents, punctuation and whitespace consistently", () => {
  if (normalizeTeamName("  Atlético   de   Madrid ") !== "atletico de madrid") throw new Error("Unexpected canonical team name");
});

Deno.test("excludes reserve, academy and youth teams but keeps senior teams", () => {
  const excluded = ["Real Madrid Castilla", "Celta Fortuna", "Ajax U21", "Team Reserves", "Club B", "Olympique II"];
  for (const team of excluded) if (!isExcludedSeniorTeam(team)) throw new Error("Expected excluded team: " + team);
  const included = ["Atletico Madrid", "Standard Liege", "FC Utrecht", "Borussia Dortmund"];
  for (const team of included) if (isExcludedSeniorTeam(team)) throw new Error("Unexpected excluded team: " + team);
});

Deno.test("team history keys remove club prefixes and retain women's identity", () => {
  if (teamHistoryKey("FC Atlético Madrid") !== "atletico madrid") throw new Error("Club-prefix normalization failed");
  if (teamHistoryKey("W FC Barcelona") !== "women barcelona") throw new Error("Women's identity marker failed");
});
