/**
 * Shared football-team identity and exclusion rules.
 * Keep provider adapters aligned so reserve/youth teams cannot leak into
 * senior fixtures and team-form lookups use the same normalized identity.
 */
export function normalizeTeamName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isExcludedSeniorTeam(value: unknown): boolean {
  const team = normalizeTeamName(value);
  return /\b(reserves?|academy|youth|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico|u(?:15|16|17|18|19|20|21|23)|under ?(?:15|16|17|18|19|20|21|23))\b/.test(team)
    || /(^| )(ii|iii|b)$/.test(team);
}

export function teamHistoryKey(value: unknown): string {
  return normalizeTeamName(value)
    .replace(/\b(fc|cf|sc|ac|afc|club)\b/g, " ")
    .replace(/\b(women|w)\b/g, " women ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect women's team/competition markers without treating a lowercase final
 * "w" in ordinary club names (for example, Sułów) as the uppercase W suffix.
 */
export function isWomensTeam(value: unknown): boolean {
  const raw = String(value ?? "");
  return /\bW\b/.test(raw)
    || /\b(women|female|girls|damallsvenskan|wsl|liga f|frauen|femenina|femenino|feminin|damen|ladies)\b/i.test(raw);
}
