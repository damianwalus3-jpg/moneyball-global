import { extractBearerToken } from "./bearer-token.ts";

Deno.test("extracts a standard Bearer token", () => {
  if (extractBearerToken("Bearer eyJhbGci.eyJzdWIi.signature") !== "eyJhbGci.eyJzdWIi.signature") {
    throw new Error("Bearer prefix was not removed");
  }
});

Deno.test("extracts a case-insensitive Bearer token", () => {
  if (extractBearerToken("bEaReR token-value") !== "token-value") {
    throw new Error("Bearer prefix should be case-insensitive");
  }
});

Deno.test("trims and accepts a raw token", () => {
  if (extractBearerToken("  raw-token  ") !== "raw-token") {
    throw new Error("Raw token normalization failed");
  }
});

Deno.test("returns an empty token for missing authorization", () => {
  if (extractBearerToken(null) !== "") throw new Error("Missing header should return empty token");
});
