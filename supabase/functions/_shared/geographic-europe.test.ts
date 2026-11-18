import { isGeographicEuropeCountry } from "./geographic-europe.ts";

Deno.test("football Europe includes European countries and UEFA football aliases", () => {
  for (const country of [
    "Albania", "ALB", "Andorra", "Bosnia & Herzegovina", "Bosnia-Herzegovina",
    "Åland Islands", "Armenia", "ARM", "Austria", "Azerbaijan", "AZE",
    "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "CYP",
    "Czechia", "Denmark", "England", "Estonia", "Faroe Islands", "Finland",
    "France", "Georgia", "GEO", "Germany", "Gibraltar", "Greece", "Hungary",
    "Iceland", "Ireland", "Isle of Man", "Italy", "Jersey", "Guernsey", "Latvia",
    "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco",
    "Montenegro", "Netherlands", "North Macedonia", "Northern Ireland", "Norway",
    "Poland", "Portugal", "Romania", "Russia", "San Marino", "Scotland", "Serbia",
    "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Türkiye",
    "TUR", "Ukraine", "Wales", "United Kingdom", "GBR", "ENG", "SCO", "WAL", "NIR",
    "Albania / Europe", "Kosovo", "KOS",
  ]) {
    if (!isGeographicEuropeCountry(country)) throw new Error(`Expected football Europe: ${country}`);
  }
});

Deno.test("geographic Europe domestic scope excludes Asia-only countries", () => {
  for (const country of ["Israel", "ISR", "Kazakhstan", "KAZ", "Europe", "UEFA", "Asia", ""]) {
    if (isGeographicEuropeCountry(country)) throw new Error(`Unexpected Europe match: ${country}`);
  }
});
