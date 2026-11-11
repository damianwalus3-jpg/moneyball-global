// All user-facing dates use Europe/Brussels, regardless of the device timezone.
export const APP_TZ = "Europe/Brussels";

const pad = (n: number) => String(n).padStart(2, "0");

function tzParts(date: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(date)) p[part.type] = part.value;
  const n = (k: string) => Number(p[k] ?? 0);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour"), mi: n("minute"), s: n("second") };
}

function offsetMs(date: Date) {
  const p = tzParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-07-01T20:00" (Brussels wall time) -> UTC ISO string. */
export function brusselsInputToISO(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let ts = guess - offsetMs(new Date(guess));
  ts = guess - offsetMs(new Date(ts));
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in Brussels, for datetime-local inputs. */
export function isoToBrusselsInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = tzParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Brussels calendar day key "YYYY-MM-DD". */
export function brusselsDayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = tzParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function nowBrusselsInput(): string {
  return isoToBrusselsInput(new Date().toISOString());
}

const dtFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: APP_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: APP_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const tFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: APP_TZ,
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtFmt.format(d);
}
export function fmtDayLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dFmt.format(d);
}
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : tFmt.format(d);
}
