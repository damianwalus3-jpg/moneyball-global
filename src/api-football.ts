export interface ApiFootballTeamRef {
  id?: number;
  name?: string;
}
export interface ApiFootballLineupPlayer {
  player?: { id?: number; name?: string; number?: number; pos?: string; grid?: string };
}
export interface ApiFootballLineup {
  team?: ApiFootballTeamRef;
  formation?: string;
  startXI?: ApiFootballLineupPlayer[];
  substitutes?: ApiFootballLineupPlayer[];
  coach?: { id?: number; name?: string };
}
export interface ApiFootballFixtureEnrichment {
  fixture?: { id?: number; date?: string; status?: { short?: string; long?: string } };
  league?: { id?: number; name?: string; country?: string; season?: number };
  teams?: { home?: ApiFootballTeamRef; away?: ApiFootballTeamRef };
  goals?: { home?: number | null; away?: number | null };
  score?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  lineups?: ApiFootballLineup[];
  statistics?: Array<{ team?: ApiFootballTeamRef; statistics?: Array<{ type?: string; value?: string | number | null }> }>;
  players?: Array<{ team?: ApiFootballTeamRef; players?: Array<Record<string, unknown>> }>;
}
export interface ApiFootballInjury {
  fixture?: { id?: number; date?: string };
  team?: ApiFootballTeamRef;
  player?: { id?: number; name?: string; type?: string; reason?: string };
}
interface BatchResponse<T> {
  provider: string;
  generatedAt: string;
  fixtures?: T[];
  injuries?: T[];
  error?: string;
  message?: string;
  retryAfterSeconds?: number;
}

export interface ApiFootballTrackerDetails {
  apiFootballFixtureId: number | null;
  apiFootballDataObservedAt: string | null;
  apiFootballEventsCount: number | null;
  apiFootballLineupsCount: number | null;
  apiFootballTeamStatisticsCount: number | null;
  apiFootballPlayerStatisticsCount: number | null;
  apiFootballInjuriesCount: number | null;
  apiFootballFixtureData?: string | null;
  apiFootballInjuries?: string | null;
}
/** Keep summary metadata on every market row, but store the full provider payload only once per fixture. */
export function buildApiFootballTrackerDetails(
  fixture?: ApiFootballFixtureEnrichment,
  injuries?: ApiFootballInjury[],
  includeFullPayload = false,
  observedAt = new Date().toISOString(),
): ApiFootballTrackerDetails {
  const details: ApiFootballTrackerDetails = {
    apiFootballFixtureId: fixture?.fixture?.id ?? null,
    apiFootballDataObservedAt: fixture || injuries !== undefined ? observedAt : null,
    apiFootballEventsCount: fixture?.events?.length ?? null,
    apiFootballLineupsCount: fixture?.lineups?.length ?? null,
    apiFootballTeamStatisticsCount: fixture?.statistics?.length ?? null,
    apiFootballPlayerStatisticsCount: fixture?.players?.length ?? null,
    apiFootballInjuriesCount: injuries?.length ?? null,
  };
  if (includeFullPayload) {
    details.apiFootballFixtureData = fixture ? JSON.stringify(fixture) : null;
    details.apiFootballInjuries = injuries !== undefined ? JSON.stringify(injuries) : null;
  }
  return details;
}

const API_ROOT = "/api/api-football";
const BATCH_SIZE = 20;
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string; retryAfterSeconds?: number };
  if (!response.ok) {
    const suffix = payload.message ?? payload.error ?? "API-Football request failed";
    const retry = payload.retryAfterSeconds ? " (spróbuj ponownie za " + payload.retryAfterSeconds + " s)" : "";
    throw new Error(String(suffix) + retry);
  }
  return payload;
}
/** Fetch all supported fixture enrichment in provider batches of max 20 IDs.
 * The Worker caches each batch for 15 minutes; sequential requests avoid bursts. */
export async function fetchApiFootballEnrichment(
  fixtureIds: string[],
  minimumIntervalMs = 6500,
): Promise<Map<string, ApiFootballFixtureEnrichment>> {
  const ids = [...new Set(fixtureIds.map(value => String(value).trim()).filter(value => /^\d{1,12}$/.test(value)))];
  const output = new Map<string, ApiFootballFixtureEnrichment>();
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += BATCH_SIZE) batches.push(ids.slice(index, index + BATCH_SIZE));
  for (let index = 0; index < batches.length; index++) {
    if (index > 0 && minimumIntervalMs > 0) await delay(minimumIntervalMs);
    const query = new URLSearchParams({ ids: batches[index].join("-") });
    const response = await fetch(API_ROOT + "/enrichment?" + query.toString(), { headers: { Accept: "application/json" } });
    const payload = await readResponse<BatchResponse<ApiFootballFixtureEnrichment>>(response);
    for (const fixture of payload.fixtures ?? []) {
      const id = fixture.fixture?.id;
      if (typeof id === "number" && Number.isFinite(id)) output.set(String(id), fixture);
    }
  }
  return output;
}
/** One daily date query returns injury/suspension rows for every fixture supported by the provider. */
export async function fetchApiFootballInjuriesForDate(date: string): Promise<ApiFootballInjury[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + "T00:00:00Z"))
    || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Nieprawidłowa data Europe/Brussels dla API-Football injuries.");
  }
  const query = new URLSearchParams({ date });
  const response = await fetch(API_ROOT + "/injuries?" + query.toString(), { headers: { Accept: "application/json" } });
  const payload = await readResponse<BatchResponse<ApiFootballInjury>>(response);
  return payload.injuries ?? [];
}
