import { openMatchdayCET1ToIso } from "./openmatchday-time.ts";

Deno.test("OpenMatchday fixed CET-1 kickoff conversion is stable in winter and summer", () => {
  if (openMatchdayCET1ToIso("2026-11-18","20:00") !== "2026-11-18T19:00:00.000Z") throw new Error("Winter CET-1 conversion failed.");
  if (openMatchdayCET1ToIso("2026-07-18","20:00") !== "2026-07-18T19:00:00.000Z") throw new Error("Summer must retain the documented fixed CET-1 source offset.");
  if (openMatchdayCET1ToIso("2026-07-18","25:00") !== null) throw new Error("Invalid source time must be rejected.");
});
