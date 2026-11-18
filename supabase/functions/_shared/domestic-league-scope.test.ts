import { isEligibleDomesticSeniorLeague, isEligibleDomesticTopTwoLeague, isEligibleOpenMatchdayTier, isUefaNationsLeagueCompetition } from "./domestic-league-scope.ts";

Deno.test("raw source inventory includes senior men's domestic leagues at every tier", () => {
  const accepted: Array<[string,string]> = [
    ["Northern Ireland","Championship"],["France","National 2 - Group C"],
    ["Czech Republic","3. liga - CFL B"],["England","National League - North"],
    ["England","Non League Premier - Isthmian"],["Scotland","Football League - Lowland League"],
    ["Ukraine","Persha Liga"],["Germany","Oberliga - Hessen"],["Bulgaria","Third League - Northeast"],
    ["Bosnia","1st League - RS"],["Poland","III Liga - Group 3"],["Spain","Tercera División RFEF - Group 13"],["Lithuania","TOPLYGA"],["Albania","Abissnet Superiore"],["San Marino","Campionato Sammarinese"],["Finland","Kakkonen"],["Faroe Islands","Meistaradeildin menn"]
  ];
  for (const [country,competition] of accepted) {
    if (!isEligibleDomesticSeniorLeague(country,competition)) throw new Error(`Expected raw senior fixture: ${country} / ${competition}`);
  }
});

Deno.test("raw inventory excludes cups, UEFA, women and youth competitions", () => {
  const rejected: Array<[string,string]> = [
    ["England","EFL Trophy"],["England","Premier League Cup"],["Italy","Coppa Italia Serie D"],
    ["France","Coupe de France"],["Spain","Primera Federación U19"],["England","Professional Development League"],
    ["Sweden","Damallsvenskan"],["Poland","Ekstraliga Women"],["World","UEFA Nations League"],
    ["World","UEFA Champions League"],["England","Premier League 2"]
  ];
  for (const [country,competition] of rejected) {
    if (isEligibleDomesticSeniorLeague(country,competition)) throw new Error(`Unexpected raw fixture: ${country} / ${competition}`);
  }
  if (!isUefaNationsLeagueCompetition("UEFA Nations League - League B")) throw new Error("Nations League classifier regression");
});

Deno.test("OpenMatchday source scope includes only its published geographic-Europe tiers one and two", () => {
  const accepted: Array<[string,string]> = [
    ["England","Premier League"],["England","Championship"],["Germany","Bundesliga"],
    ["Germany","2. Bundesliga"],["France","Ligue 1"],["France","Ligue 2"],
    ["Italy","Serie A"],["Italy","Serie B"],["Ukraine","Persha Liga"],
    ["Northern Ireland","Championship"],["Scotland","Championship"],["Wales","Cymru North"],
    ["Iceland","Lengjudeild karla"],["Faroe Islands","Meistaradeildin"],
    ["Albania","Abissnet Superiore"],["Bosnia and Herzegovina","WWIN Liga Bosne i Hercegovine"],["Bosnia","1st League - RS"],
    ["Bulgaria","efbet League"],["Lithuania","TOPLYGA"],["Luxembourg","BGL Ligue"],["Latvia","Virsliga"],["Estonia","Meistriliiga"],["Estonia","Esiliiga"],["Belgium","Jupiler Pro League"],["Belgium","Challenger Pro League"],["Switzerland","Challenge League"],["Northern Ireland","NIFL Championship"],["Malta","Maltese Challenge League"]
  ];
  for (const [country,competition] of accepted) {
    if (!isEligibleDomesticTopTwoLeague(country,competition)) throw new Error(`Expected tier 1/2: ${country} / ${competition}`);
  }
  const rejected: Array<[string,string]> = [
    ["France","National 2 - Group C"],["Czech Republic","3. liga - CFL B"],
    ["England","National League - North"],["Scotland","Lowland League"],
    ["Germany","Oberliga - Hessen"],["Bulgaria","Third League - Northeast"],
    ["Poland","III Liga - Group 3"],["Spain","Tercera División RFEF - Group 13"],["Spain","Segunda División RFEF - Group 1"],["England","Non League Premier - Southern South"],["Germany","Regionalliga - Nord"],["Germany","Oberliga - Rheinland-Pfalz / Saar"],["Bulgaria","Third League - Southwest"],["Belarus","Second League - Group A"],["England","EFL Trophy"],["England","Premier League 2"],["Sweden","Damallsvenskan"],
    ["World","UEFA Nations League"],["Turkey","Super Lig"]
  ];
  for (const [country,competition] of rejected) {
    if (isEligibleDomesticTopTwoLeague(country,competition)) throw new Error(`Unexpected tier 1/2: ${country} / ${competition}`);
  }
});

Deno.test("OpenMatchday tier metadata admits only folders one and two", () => {
  for (const folder of ["ENG_1_Premier-League","ENG_2_Championship","DEU_1_Bundesliga","FRA_2_Ligue-2"]) {
    if (!isEligibleOpenMatchdayTier(folder)) throw new Error(`Expected eligible folder: ${folder}`);
  }
  for (const folder of ["ENG_3_League-One","ENG_4_League-Two","ENG_1_FA-Cup","ENG_1_Womens-Super-League","invalid"]) {
    if (isEligibleOpenMatchdayTier(folder)) throw new Error(`Unexpected eligible folder: ${folder}`);
  }
});
