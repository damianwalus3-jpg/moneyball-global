import { describe, expect, it } from "vitest";
import { selectEspnLeagues } from "../../supabase/functions/moneyball-results-sync/espn-leagues.ts";

describe("selectEspnLeagues", () => {
  it("does not query ESPN when there are no overdue fixtures", () => {
    expect(selectEspnLeagues([])).toEqual([]);
  });

  it("selects only the country represented in the overdue fixture set", () => {
    expect(selectEspnLeagues([{ country: "Belgium", league: "First Division A", gender: "men" }])).toEqual(["bel.1"]);
  });

  it("does not query unrelated countries from the static catalogue", () => {
    expect(selectEspnLeagues([{ country: "England", league: "Premier League", gender: "men" }])).toEqual(["eng.1"]);
  });

  it("selects a matching second-tier competition", () => {
    expect(selectEspnLeagues([{ country: "England", league: "Championship", gender: "men" }])).toEqual(["eng.2"]);
  });

  it("keeps women's competitions separate from men's leagues", () => {
    expect(selectEspnLeagues([{ country: "England", league: "Women's Super League", gender: "women" }])).toEqual(["eng.w.1"]);
    expect(selectEspnLeagues([{ country: "England", league: "Women's FA Cup", gender: "women" }])).toEqual(["eng.w.fa"]);
  });

  it("selects only the matching UEFA competition", () => {
    expect(selectEspnLeagues([{ country: "Europe", league: "UEFA Champions League", gender: "men" }])).toEqual(["uefa.champions"]);
    expect(selectEspnLeagues([{ country: "World", league: "UEFA U21 Championship - Qualification", gender: "men" }])).toEqual(["uefa.euro_u21_qual"]);
    expect(selectEspnLeagues([{ country: "World", league: "UEFA Nations League", gender: "men" }])).toEqual(["uefa.nations"]);
  });

  it("deduplicates multiple fixtures in the same competition", () => {
    expect(selectEspnLeagues([
      { country: "Spain", league: "LaLiga", gender: "men" },
      { country: "Spain", league: "LaLiga", gender: "men" },
    ])).toEqual(["esp.1"]);
  });
});
