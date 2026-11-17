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
const STORAGE_KEY = "moneyball.local.tracker.v1";
const VALID_KINDS: TrackerKind[] = ["scan","match","prediction","coupon","result","odds","ledger","category","jackpot"];

function isRecord(value: unknown): value is TrackerRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TrackerRecord>;
  return typeof row.id === "string" && VALID_KINDS.includes(row.kind as TrackerKind)
    && typeof row.title === "string" && typeof row.status === "string"
    && !!row.details && typeof row.details === "object" && typeof row.createdAt === "string";
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
}
export function addRecord(input: Omit<TrackerRecord, "id" | "createdAt">): TrackerRecord {
  const row: TrackerRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeRecords([row, ...readRecords()]);
  return row;
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
  const missing = backup.records.filter(row => !ids.has(row.id));
  writeRecords([...missing, ...existing]);
  return missing.length;
}
