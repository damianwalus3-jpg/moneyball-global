import { isEligibleDomesticSeniorLeague } from "./domestic-league-scope.ts";
Deno.test("includes senior domestic leagues at every division level in geographic Europe", () => {
  const accepted: Array<[string,string]> = [["Northern Ireland","Championship"],["France","National 2 - Group C"],["Czech Republic","3. liga - CFL B"],["England","National League - North"],["England","National League - South"],["England","Non League Premier - Isthmian"],["England","Non League Premier - Northern"],["England","Non League Premier - Southern Central"],["England","Non League Premier - Southern South"],["Scotland","Football League - Lowland League"],["Ukraine","Persha Liga"],["Germany","Oberliga"],["Bulgaria","Third League - Northeast"],["Bulgaria","Third League - Southwest"],["Bosnia","1st League - RS"],["Poland","III Liga - Group 3"]];
  for (const [country,competition] of accepted) if (!isEligibleDomesticSeniorLeague(country,competition)) throw new Error("Expected eligible: "+country+" / "+competition);
});
Deno.test("excludes cups, international fixtures, youth, women's and non-European competitions", () => {
  const rejected: Array<[string,string]> = [["England","EFL Trophy"],["England","Premier League Cup"],["England","Professional Development League"],["World","UEFA Nations League"],["France","Coupe de France"],["Spain","Primera Federación U19"],["Sweden","Damallsvenskan"],["Israel","Premier League"]];
  for (const [country,competition] of rejected) if (isEligibleDomesticSeniorLeague(country,competition)) throw new Error("Unexpected eligible: "+country+" / "+competition);
});
