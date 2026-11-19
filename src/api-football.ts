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
/** Conservative shared pacing for every API-Football call made by this app tab. */
export const API_FOOTBALL_MIN_INTERVAL_MS = 2_000;
let lastApiFootballRequestAt = 0;
let apiFootballBlockedUntil = 0;
let apiFootballRequestQueue: Promise<void> = Promise.resolve();

/** Reset only the in-memory limiter between unit tests; never called by the app. */
export function resetApiFootballRequestThrottleForTests(): void {
  lastApiFootballRequestAt = 0;
  apiFootballBlockedUntil = 0;
  apiFootballRequestQueue = Promise.resolve();
}


function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Serialize requests across fixtures, enrichment and injuries; honour provider Retry-After. */
async function pacedApiFootballFetch(path: string, minimumIntervalMs = API_FOOTBALL_MIN_INTERVAL_MS): Promise<Response> {
  let release!: () => void;
  const previous = apiFootballRequestQueue;
  apiFootballRequestQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    // A provider cooldown must not stall the rest of the match analysis for minutes.
    // Fail fast without sending another provider request; a later user-triggered run
    // can retry after Retry-After has elapsed.
    if (apiFootballBlockedUntil > Date.now()) {
      const retrySeconds = Math.ceil((apiFootballBlockedUntil - Date.now()) / 1000);
      throw new Error("API-Football limit aktywny (spróbuj ponownie za " + retrySeconds + " s).");
    }
    const nextAllowedAt = lastApiFootballRequestAt + Math.max(0, minimumIntervalMs);
    const waitMs = Math.max(0, nextAllowedAt - Date.now());
    if (waitMs > 0) await delay(waitMs);
    lastApiFootballRequestAt = Date.now();
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const retrySeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
      apiFootballBlockedUntil = Math.max(apiFootballBlockedUntil, Date.now() + retrySeconds * 1000);
    }
    return response;
  } finally {
    release();
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string; retryAfterSeconds?: number };
  if (!response.ok) {
    const suffix = payload.message ?? payload.error ?? "API-Football request failed";
    const retrySeconds = payload.retryAfterSeconds ?? (response.status === 429 ? 60 : 0);
    const retry = retrySeconds ? " (spróbuj ponownie za " + retrySeconds + " s)" : "";
    throw new Error(String(suffix) + retry);
  }
  return payload;
}

function assertBrusselsDate(date: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + "T00:00:00Z"))
    || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Nieprawidłowa data Europe/Brussels dla API-Football " + label + ".");
  }
}

/** Fetch the Brussels-local daily fixture feed through the same shared quota queue. */
export async function fetchApiFootballFixturesForDate(
  date: string,
  minimumIntervalMs = API_FOOTBALL_MIN_INTERVAL_MS,
): Promise<{ results?: number; generatedAt?: string; fixtures?: unknown[] }> {
  assertBrusselsDate(date, "fixtures");
  const response = await pacedApiFootballFetch(API_ROOT + "/fixtures/" + date, minimumIntervalMs);
  return readResponse(response);
}

/** Fetch all supported fixture enrichment in provider batches of max 20 IDs.
 * Worker caches each batch for 15 minutes; all batches share a conservative request queue. */
export async function fetchApiFootballEnrichment(
  fixtureIds: string[],
  minimumIntervalMs = API_FOOTBALL_MIN_INTERVAL_MS,
): Promise<Map<string, ApiFootballFixtureEnrichment>> {
  const ids = [...new Set(fixtureIds.map(value => String(value).trim()).filter(value => /^\d{1,12}$/.test(value)))];
  const output = new Map<string, ApiFootballFixtureEnrichment>();
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += BATCH_SIZE) batches.push(ids.slice(index, index + BATCH_SIZE));
  for (const batch of batches) {
    const query = new URLSearchParams({ ids: batch.join("-") });
    const response = await pacedApiFootballFetch(API_ROOT + "/enrichment?" + query.toString(), minimumIntervalMs);
    const payload = await readResponse<BatchResponse<ApiFootballFixtureEnrichment>>(response);
    for (const fixture of payload.fixtures ?? []) {
      const id = fixture.fixture?.id;
      if (typeof id === "number" && Number.isFinite(id)) output.set(String(id), fixture);
    }
  }
  return output;
}

/** One daily date query returns injury/suspension rows for every fixture supported by the provider. */
export async function fetchApiFootballInjuriesForDate(
  date: string,
  minimumIntervalMs = API_FOOTBALL_MIN_INTERVAL_MS,
): Promise<ApiFootballInjury[]> {
  assertBrusselsDate(date, "injuries");
  const query = new URLSearchParams({ date });
  const response = await pacedApiFootballFetch(API_ROOT + "/injuries?" + query.toString(), minimumIntervalMs);
  const payload = await readResponse<BatchResponse<ApiFootballInjury>>(response);
  return payload.injuries ?? [];
}
