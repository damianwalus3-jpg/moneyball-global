import { isGeographicEuropeCountry } from "./geographic-europe.ts";

Deno.test("geographic Europe includes M49 European countries and football aliases", () => {
  for (const country of [
    "Albania", "ALB", "Andorra", "Bosnia & Herzegovina", "Bosnia-Herzegovina", "Åland Islands", "Austria", "Belgium", "Bosnia and Herzegovina",
    "Bulgaria", "BGR", "Croatia", "Czechia", "Denmark", "England", "Estonia",
    "Faroe Islands", "Finland", "France", "Germany", "Gibraltar", "Greece",
    "Hungary", "Iceland", "Ireland", "Isle of Man", "Italy", "Jersey", "JEY", "Guernsey", "GGY", "Latvia",
    "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco",
    "Montenegro", "Netherlands", "North Macedonia", "Northern Ireland", "Norway",
    "Poland", "Portugal", "Romania", "Russia", "San Marino", "Scotland",
    "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
    "Ukraine", "Wales", "United Kingdom", "GBR", "ENG", "SCO", "WAL", "NIR",
    "Albania / Europe", "Kosovo", "KOS",
  ]) {
    if (!isGeographicEuropeCountry(country)) throw new Error(`Expected Europe: ${country}`);
  }
});

Deno.test("geographic Europe rejects Asian countries regardless of UEFA membership", () => {
  for (const country of [
    "Israel", "ISR", "Armenia", "ARM", "Azerbaijan", "AZE", "Cyprus", "CYP",
    "Georgia", "GEO", "Kazakhstan", "KAZ", "Türkiye", "Turkey", "TUR",
    "Europe", "UEFA", "Asia", "",
  ]) {
    if (isGeographicEuropeCountry(country)) throw new Error(`Unexpected Europe match: ${country}`);
  }
});
