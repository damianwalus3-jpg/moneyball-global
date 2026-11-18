import { isGeographicEuropeCountry } from "./geographic-europe.ts";

Deno.test("geographic Europe follows the established M49 football boundary", () => {
  for (const country of [
    "Albania","ALB","Andorra","Bosnia & Herzegovina","Bosnia-Herzegovina",
    "Åland Islands","Austria","Belarus","Belgium","Bulgaria","Croatia",
    "Czechia","Denmark","England","Estonia","Faroe Islands","Finland","France",
    "Germany","Gibraltar","Greece","Guernsey","Hungary","Iceland","Ireland",
    "Isle of Man","Italy","Jersey","Latvia","Liechtenstein","Lithuania",
    "Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands",
    "North Macedonia","Northern Ireland","Norway","Poland","Portugal","Romania",
    "Russia","San Marino","Scotland","Serbia","Slovakia","Slovenia","Spain",
    "Sweden","Switzerland","Ukraine","Wales","United Kingdom","GBR","ENG","SCO",
    "WAL","NIR","Albania / Europe","Kosovo","KOS","Svalbard and Jan Mayen","Vatican City"
  ]) {
    if (!isGeographicEuropeCountry(country)) throw new Error(`Expected geographic Europe: ${country}`);
  }
});

Deno.test("UEFA membership alone does not widen geographic Europe", () => {
  for (const country of [
    "Turkey","Türkiye","TUR","Cyprus","CYP","Armenia","ARM","Azerbaijan","AZE",
    "Georgia","GEO","Israel","ISR","Kazakhstan","KAZ","Europe","UEFA","Asia",""
  ]) {
    if (isGeographicEuropeCountry(country)) throw new Error(`Unexpected geographic Europe match: ${country}`);
  }
});
