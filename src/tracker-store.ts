export type TrackerKind = "scan" | "match" | "prediction" | "coupon" | "result" | "odds" | "ledger" | "category" | "jackpot";
export interface TrackerRecord {
  id: string;
  kind: TrackerKind;
  title: string;
  status: string;
  details: Record<string, string | number | boolean | null>;
  createdAt: string;
}
export interface MoneyballBackup {
  format: "moneyball-local-backup";
  version: 1;
  exportedAt: string;
  records: TrackerRecord[];
}
type NewTrackerRecord = Omit<TrackerRecord, "id" | "createdAt">;
const STORAGE_KEY = "moneyball.local.tracker.v1";
const VALID_KINDS: TrackerKind[] = ["scan","match","prediction","coupon","result","odds","ledger","category","jackpot"];

function isRecord(value: unknown): value is TrackerRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TrackerRecord>;
  const detailsValid = !!row.details && typeof row.details === "object" && !Array.isArray(row.details)
    && Object.values(row.details).every(item => item === null || typeof item === "string" || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item)));
  return typeof row.id === "string" && row.id.length > 0 && VALID_KINDS.includes(row.kind as TrackerKind)
    && typeof row.title === "string" && typeof row.status === "string"
    && detailsValid && typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt));
}

export function readRecords(): TrackerRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch { return []; }
}
export function writeRecords(records: TrackerRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("moneyball:tracker-updated"));
}
export function addRecord(input: NewTrackerRecord): TrackerRecord {
  const row: TrackerRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeRecords([row, ...readRecords()]);
  return row;
}

/**
 * Adds records only when no existing record of the same kind has the same
 * string value in uniqueDetailField. Existing rows are never overwritten.
 * This is used by repeatable fixture scans to preserve history idempotently.
 */
export function addRecordsIfMissing(inputs: NewTrackerRecord[], uniqueDetailField: string): number {
  const existing = readRecords();
  const keys = new Set(existing.flatMap(row => {
    const value = row.details[uniqueDetailField];
    return typeof value === "string" ? [`${row.kind}|${value}`] : [];
  }));
  const added: TrackerRecord[] = [];
  for (const input of inputs) {
    const value = input.details[uniqueDetailField];
    if (typeof value !== "string") continue;
    const key = `${input.kind}|${value}`;
    if (keys.has(key)) continue;
    keys.add(key);
    added.push({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  }
  if (added.length) writeRecords([...added, ...existing]);
  return added.length;
}
export function removeRecord(id: string): void {
  writeRecords(readRecords().filter(row => row.id !== id));
}
export function exportBackup(): MoneyballBackup {
  return { format: "moneyball-local-backup", version: 1, exportedAt: new Date().toISOString(), records: readRecords() };
}
export function validateBackup(value: unknown): MoneyballBackup {
  if (!value || typeof value !== "object") throw new Error("Nieprawidłowy plik kopii zapasowej.");
  const backup = value as Partial<MoneyballBackup>;
  if (backup.format !== "moneyball-local-backup" || backup.version !== 1 || !Array.isArray(backup.records) || !backup.records.every(isRecord)) {
    throw new Error("Format kopii zapasowej jest nieobsługiwany lub uszkodzony.");
  }
  return backup as MoneyballBackup;
}
export function importBackup(value: unknown): number {
  const backup = validateBackup(value);
  const existing = readRecords();
  const ids = new Set(existing.map(row => row.id));
  const missing = backup.records.filter(row => {
    if (ids.has(row.id)) return false;
    ids.add(row.id);
    return true;
  });
  if (missing.length) writeRecords([...missing, ...existing].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  return missing.length;
}

export function exportCsv(records: TrackerRecord[] = readRecords()): string {
  const headers = ["id", "createdAt", "kind", "title", "status", "details"];
  const cell = (value: unknown) => {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [headers.map(cell).join(","), ...records.map(row => [row.id, row.createdAt, row.kind, row.title, row.status, JSON.stringify(row.details)].map(cell).join(","))].join("\r\n");
}
