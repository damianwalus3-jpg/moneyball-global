import { isExcludedSeniorTeam, isMenGender, isWomensTeam, normalizeTeamName, teamHistoryKey } from "./team-normalization.ts";

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

Deno.test("detects women's W suffix without false positives on lowercase club-name endings", () => {
  const women = ["Häcken W", "Manchester City Women", "Frauen Bundesliga", "WSL"];
  for (const team of women) if (!isWomensTeam(team)) throw new Error("Expected women's marker: " + team);
  const men = ["Barycz Sułów", "Wolves", "Standard Liege", "Manchester City"];
  for (const team of men) if (isWomensTeam(team)) throw new Error("False women's marker: " + team);
});

Deno.test("requires an explicit men's gender marker and rejects unknown gender", () => {
  for (const value of ["men", "male", "M", "mens", "men senior"]) {
    if (!isMenGender(value)) throw new Error("Expected men's gender marker: " + value);
  }
  for (const value of [null, undefined, "", "unknown", "women", "female", "mixed"]) {
    if (isMenGender(value)) throw new Error("Unexpectedly accepted non-men/unknown gender: " + String(value));
  }
});
