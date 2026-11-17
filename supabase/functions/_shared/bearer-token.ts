/** Normalize an Authorization header to the raw bearer JWT before forwarding it. */
export function extractBearerToken(authorization: string | null): string {
  if (!authorization) return "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
