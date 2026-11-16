export type EspnLeagueNeed = { country?: unknown; league?: unknown; gender?: unknown };

const COUNTRY_PREFIX: Record<string, string> = {
  england: "eng", eng: "eng", spain: "esp", italy: "ita", germany: "ger",
  france: "fra", belgium: "bel", netherlands: "ned", portugal: "por",
  scotland: "sco", austria: "aut", greece: "gre", turkey: "tur",
  russia: "rus", sweden: "swe", denmark: "den", norway: "nor",
  poland: "pol", ukraine: "ukr", switzerland: "sui",
};

const TOP_TIER = new Set([
  "eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "bel.1", "ned.1", "por.1",
  "sco.1", "aut.1", "gre.1", "tur.1", "rus.1", "swe.1", "den.1", "nor.1",
  "pol.1", "ukr.1", "sui.1",
]);
const SECOND_TIER = new Set(["eng.2", "esp.2", "ita.2", "ger.2", "fra.2"]);
const WOMEN: Record<string, string[]> = {
  eng: ["eng.w.1", "eng.w.fa", "eng.w.league_cup", "eng.w.promotion.relegation"],
  esp: ["esp.w.1"], fra: ["fra.w.1"], ned: ["ned.w.1", "ned.w.knvb_cup"],
};

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Select only ESPN competitions represented by overdue European fixtures. */
export function selectEspnLeagues(fixtures: EspnLeagueNeed[]): string[] {
  const selected = new Set<string>();
  for (const fixture of fixtures) {
    const country = normalize(fixture.country);
    const competition = normalize(fixture.league);
    const gender = normalize(fixture.gender);
    const isWomen = gender === "women" || /\b(women|womens|female|girls)\b/.test(competition);

    const isUefaCompetition = /\b(champions league|europa league|conference league|nations league|uefa)\b/.test(competition);
    if (isUefaCompetition) {
      if (/\bwomen|female\b/.test(competition) || isWomen) {
        if (/\bnations\b/.test(competition)) selected.add("uefa.w.nations");
        else selected.add("uefa.w.europa");
      } else if (/\bchampions\b/.test(competition)) selected.add("uefa.champions");
      else if (/\bconference\b/.test(competition)) selected.add("uefa.europa.conf");
      else if (/\beuropa\b/.test(competition)) selected.add("uefa.europa");
      else if (/\bnations\b/.test(competition)) selected.add("uefa.nations");
    }

    if (isUefaCompetition) continue;
    const prefix = COUNTRY_PREFIX[country];
    if (!prefix) continue;
    if (isWomen) {
      const womensCompetitions = WOMEN[prefix] ?? [];
      const cupCode = /\b(fa cup)\b/.test(competition) ? prefix + ".w.fa"
        : /\b(league cup)\b/.test(competition) ? prefix + ".w.league_cup"
        : /\b(promotion|relegation)\b/.test(competition) ? prefix + ".w.promotion.relegation"
        : /\b(knvb cup)\b/.test(competition) ? prefix + ".w.knvb_cup"
        : null;
      const leagueCode = womensCompetitions.find((code) => code.endsWith(".1"));
      if (cupCode && womensCompetitions.includes(cupCode)) selected.add(cupCode);
      else if (leagueCode) selected.add(leagueCode);
      continue;
    }

    const isSecondTier = /\b(championship|segunda|serie b|2 bundesliga|bundesliga 2|ligue 2|second division|division 2)\b/.test(competition);
    const isThirdTier = /\b(league one|division 3|third division)\b/.test(competition);
    const isFourthTier = /\b(league two|division 4|fourth division)\b/.test(competition);
    if (isSecondTier && SECOND_TIER.has(prefix + ".2")) selected.add(prefix + ".2");
    else if (isThirdTier && prefix === "eng") selected.add("eng.3");
    else if (isFourthTier && prefix === "eng") selected.add("eng.4");
    else if (TOP_TIER.has(prefix + ".1")) selected.add(prefix + ".1");
  }
  return [...selected].sort();
}
