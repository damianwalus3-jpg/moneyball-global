import { isEligibleDomesticSeniorLeague, isUefaNationsLeagueCompetition } from "./domestic-league-scope.ts";

Deno.test("includes European domestic leagues at every tier, gender and reserve level", () => {
  const accepted: Array<[string,string]> = [
    ["Northern Ireland","Championship"],
    ["France","National 2 - Group C"],
    ["Czech Republic","3. liga - CFL B"],
    ["England","National League - North"],
    ["England","Non League Premier - Isthmian"],
    ["Scotland","Football League - Lowland League"],
    ["Ukraine","Persha Liga"],
    ["Germany","Oberliga - Hessen"],
    ["Bulgaria","Third League - Northeast"],
    ["Bosnia","1st League - RS"],
    ["Poland","III Liga - Group 3"],
    ["Turkey","2. Lig"],
    ["Spain","Tercera División RFEF - Group 13"],
    ["Poland","Ekstraliga Women"],
    ["Sweden","Damallsvenskan"],
    ["Georgia","Erovnuli Liga"],
    ["Armenia","Armenian Premier League"],
    ["Azerbaijan","Premyer Liqa"],
    ["Cyprus","Cyprus First Division"],
  ];
  for (const [country,competition] of accepted) {
    if (!isEligibleDomesticSeniorLeague(country,competition)) throw new Error(`Expected eligible: ${country} / ${competition}`);
  }
});

Deno.test("includes UEFA Nations League, but not other international competitions", () => {
  for (const competition of ["UEFA Nations League","UEFA Nations League - League B","UEFA Womens Nations League","UEFA Women's Nations League"]) {
    if (!isUefaNationsLeagueCompetition(competition) || !isEligibleDomesticSeniorLeague("World",competition)) {
      throw new Error(`Expected eligible UEFA Nations League: ${competition}`);
    }
  }
  for (const competition of ["CONCACAF Nations League","UEFA Champions League","UEFA Europa League","UEFA U21 Championship - Qualification","International Friendly"]) {
    if (isEligibleDomesticSeniorLeague("World",competition)) throw new Error(`Unexpected international competition: ${competition}`);
  }
});

Deno.test("excludes domestic cups, qualifiers, youth tournaments and friendlies", () => {
  const rejected: Array<[string,string]> = [
    ["England","EFL Trophy"],["England","Premier League Cup"],["Italy","Coppa Italia Serie D"],
    ["France","Coupe de France"],["Spain","Primera Federación U19"],["England","Professional Development League"],
    ["Portugal","Liga Revelacao U23"],["England","International Friendly"],["Turkey","Cup"],
  ];
  for (const [country,competition] of rejected) {
    if (isEligibleDomesticSeniorLeague(country,competition)) throw new Error(`Unexpected eligible: ${country} / ${competition}`);
  }
});
