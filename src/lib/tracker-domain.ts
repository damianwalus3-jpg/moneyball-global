export type TrackerDecision =
  | "FINAL" | "WATCH" | "LEAN" | "CONDITIONAL" | "REJECTED" | "PASS" | "PAPER"
  | "PRELIMINARY" | "NO_DATA" | "UNKNOWN";

export type TrackerSettlement =
  | "PENDING" | "WIN" | "LOSS" | "VOID" | "PUSH" | "HALF_WIN" | "HALF_LOSS";

export type TrackerSourceClass = "USER" | "MODEL" | "PAPER" | "UNCLASSIFIED";

export interface TrackerCategoryDefinition {
  key: string;
  label: string;
  description: string;
  group: "CORE" | "SPORT" | "LEGACY";
  persisted: boolean;
}

export const TRACKER_CATEGORIES: readonly TrackerCategoryDefinition[] = [
  { key: "TYP_DNIA", label: "TYP DNIA", description: "Główny wybór dnia", group: "CORE", persisted: false },
  { key: "MAIN_A", label: "MAIN A", description: "Podstawowy rejestr MAIN A", group: "CORE", persisted: true },
  { key: "MAIN_B", label: "MAIN B", description: "Podstawowy rejestr MAIN B", group: "CORE", persisted: true },
  { key: "EXTRA", label: "EXTRA", description: "Dodatkowe selekcje i kupony", group: "CORE", persisted: true },
  { key: "MEGA", label: "MEGA", description: "Kupony MEGA", group: "CORE", persisted: true },
  { key: "LOW_LEAGUE", label: "LOW LEAGUE", description: "Osobny rejestr niższych lig", group: "CORE", persisted: false },
  { key: "MULTI_SPORT", label: "MULTI-SPORT", description: "Wydarzenia spoza piłki nożnej", group: "SPORT", persisted: false },
  { key: "NHL_NBA", label: "NHL / NBA", description: "Osobne rejestry hokeja i koszykówki", group: "SPORT", persisted: false },
  { key: "JACKPOT", label: "JACKPOT", description: "Kupony z niezmienną numeracją", group: "CORE", persisted: false },
  { key: "LEGACY_MAIN", label: "MAIN · legacy", description: "Historyczna grupa MAIN — bez automatycznego przepisywania do MAIN A/B", group: "LEGACY", persisted: true },
  { key: "LEGACY_GOALS", label: "GOALS · legacy", description: "Historyczna grupa GOALS", group: "LEGACY", persisted: true },
  { key: "LEGACY_TEST", label: "TEST · legacy", description: "Historyczne wpisy testowe", group: "LEGACY", persisted: true },
  { key: "LEGACY_BASELINE", label: "BASELINE / NISKA WIARYGODNOŚĆ", description: "Historyczna grupa zachowana bez zmiany", group: "LEGACY", persisted: true },
  { key: "LEGACY_MARKET_DATA_TEST", label: "MARKET DATA / TEST", description: "Historyczna grupa techniczna zachowana bez zmiany", group: "LEGACY", persisted: true },
] as const;

const CATEGORY_BY_LEGACY_VALUE: Record<string, string> = {
  "TYP DNIA": "TYP_DNIA",
  "MAIN A": "MAIN_A",
  "MAIN B": "MAIN_B",
  "EXTRA": "EXTRA",
  "MEGA": "MEGA",
  "LOW LEAGUE": "LOW_LEAGUE",
  "MULTI-SPORT": "MULTI_SPORT",
  "NHL/NBA": "NHL_NBA",
  "JACKPOT": "JACKPOT",
  "MAIN": "LEGACY_MAIN",
  "GOALS": "LEGACY_GOALS",
  "TEST": "LEGACY_TEST",
  "BASELINE / NISKA WIARYGODNOŚĆ": "LEGACY_BASELINE",
  "MARKET DATA / TEST": "LEGACY_MARKET_DATA_TEST",
};

/** Exact legacy labels are preserved; unknown values remain visible as unknown. */
export function resolveTrackerCategory(raw: string | null | undefined): string {
  const value = raw?.trim().replace(/\s+/g, " ").toLocaleUpperCase("pl-BE");
  if (!value) return "UNCLASSIFIED";
  return CATEGORY_BY_LEGACY_VALUE[value] ?? "UNCLASSIFIED";
}

/** Map only unambiguous legacy verdicts; do not invent WATCH/LEAN/PAPER labels. */
export function normalizeTrackerDecision(raw: string | null | undefined): TrackerDecision {
  const value = raw?.trim().toLocaleUpperCase("pl-BE");
  if (value === "WYBRANY" || value === "FINAL") return "FINAL";
  if (value === "ODRZUCONY" || value === "REJECTED") return "REJECTED";
  if (value === "WSTĘPNY" || value === "PRELIMINARY") return "PRELIMINARY";
  if (value === "BRAK DANYCH" || value === "NO_DATA") return "NO_DATA";
  if (value === "WATCH" || value === "LEAN" || value === "CONDITIONAL" || value === "PASS" || value === "PAPER") return value;
  return "UNKNOWN";
}

export function normalizeTrackerSettlement(raw: string | null | undefined): TrackerSettlement {
  const value = raw?.trim().toLocaleUpperCase("pl-BE");
  if (value === "WON" || value === "WIN") return "WIN";
  if (value === "LOST" || value === "LOSS") return "LOSS";
  if (value === "VOID") return "VOID";
  if (value === "PUSH") return "PUSH";
  if (value === "HALF_WIN") return "HALF_WIN";
  if (value === "HALF_LOSS") return "HALF_LOSS";
  return "PENDING";
}

/** Missing legacy source metadata must never be guessed as USER or MODEL. */
export function normalizeTrackerSourceClass(raw: string | null | undefined): TrackerSourceClass {
  const value = raw?.trim().toLocaleUpperCase("pl-BE");
  if (value === "USER" || value === "MODEL" || value === "PAPER") return value;
  return "UNCLASSIFIED";
}

export function formatJackpotSequence(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Numer Jackpot musi być dodatnią liczbą całkowitą.");
  return "#" + String(sequence).padStart(3, "0");
}

/** Build a collision-resistant, owner-local key for a custom category. */
export function makeTrackerCategoryKey(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!slug) throw new Error("Nazwa kategorii musi zawierać litery lub cyfry.");
  return `CUSTOM_${slug}`;
}
