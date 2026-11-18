import { shouldSkipMoviOddsSync } from "./movi-odds-config.ts";

Deno.test("missing MOVIODDS_API_KEY skips sync before provider requests", () => {
  if (!shouldSkipMoviOddsSync("")) throw new Error("Missing key must skip.");
  if (!shouldSkipMoviOddsSync("   ")) throw new Error("Whitespace-only key must skip.");
  if (shouldSkipMoviOddsSync("configured-key")) throw new Error("Configured key must allow sync.");
});
