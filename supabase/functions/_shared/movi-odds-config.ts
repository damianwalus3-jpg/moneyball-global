export function shouldSkipMoviOddsSync(apiKey: string): boolean {
  return apiKey.trim().length === 0;
}
