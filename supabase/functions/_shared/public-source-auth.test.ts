import { selectPublicSourceApiKey } from "./public-source-auth.ts";

Deno.test("internal public-source calls prefer the service-role key", () => {
  if (selectPublicSourceApiKey("service-role-key","anon-key") !== "service-role-key") {
    throw new Error("Internal function call must prefer service-role credentials.");
  }
  if (selectPublicSourceApiKey("","anon-key") !== "anon-key") {
    throw new Error("Anon key remains the safe fallback when no service-role key is configured.");
  }
});
