// Connection config for the owner's existing Supabase project.
// Only the publishable/anon key is ever accepted; secret/service_role keys are rejected.
export const DEFAULT_SUPABASE_URL = "https://gzgeklcukrclgwbsmbsp.supabase.co";
export const EXPECTED_PROJECT_REF = "gzgeklcukrclgwbsmbsp";

export type OwnerColumn = "user_id" | "owner_id";

export interface AppConfig {
  url: string;
  anonKey: string;
  ownerColumn: OwnerColumn;
  source: "env" | "local";
}

const STORAGE_KEY = "moneyball.connection.v1";
const PREFS_KEY = "moneyball.prefs.v1";

export type KeyCheck = { ok: true; kind: "publishable" | "anon-jwt" } | { ok: false; reason: string };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function projectRefFromUrl(url: string): string | null {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(url.trim());
  return m?.[1] ? m[1].toLowerCase() : null;
}

export function validateSupabaseUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return "Podaj adres projektu.";
  if (!/^https:\/\//.test(u)) return "Adres musi zaczynać się od https://";
  try {
    new URL(u);
  } catch {
    return "Nieprawidłowy adres URL.";
  }
  return null;
}

export function validatePublicKey(rawKey: string, url = DEFAULT_SUPABASE_URL): KeyCheck {
  const key = rawKey.trim();
  if (!key) return { ok: false, reason: "Wklej klucz publiczny (publishable / anon)." };
  if (/^sb_secret_/i.test(key) || /service_role/i.test(key))
    return {
      ok: false,
      reason: "To jest klucz SEKRETNY. Nigdy go tu nie wklejaj — użyj klucza publishable/anon.",
    };
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return { ok: true, kind: "publishable" };
  const parts = key.split(".");
  if (parts.length === 3) {
    const payload = decodeJwtPayload(key);
    if (!payload) return { ok: false, reason: "Nie można odczytać klucza JWT." };
    if (payload["role"] === "service_role")
      return {
        ok: false,
        reason: "To jest klucz service_role (sekretny). Użyj klucza anon/publishable.",
      };
    if (payload["role"] !== "anon") return { ok: false, reason: "Klucz nie ma roli anon." };
    const ref = projectRefFromUrl(url);
    if (ref && typeof payload["ref"] === "string" && payload["ref"] !== ref)
      return { ok: false, reason: `Klucz należy do innego projektu (${payload["ref"]}).` };
    return { ok: true, kind: "anon-jwt" };
  }
  return { ok: false, reason: "Nieznany format klucza. Oczekiwano sb_publishable_… lub klucza anon (JWT)." };
}

function envConfig(): { url?: string | undefined; key?: string | undefined } {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    url: env["VITE_SUPABASE_URL"],
    key: env["VITE_SUPABASE_ANON_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  };
}

export function readConfig(): AppConfig | null {
  const env = envConfig();
  let stored: Partial<AppConfig> = {};
  if (typeof window !== "undefined") {
    try {
      stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      stored = {};
    }
  }
  const ownerColumn: OwnerColumn = stored.ownerColumn === "user_id" ? "user_id" : "owner_id";
  if (env.key) {
    const url = env.url ?? DEFAULT_SUPABASE_URL;
    if (validatePublicKey(env.key, url).ok) return { url, anonKey: env.key, ownerColumn, source: "env" };
  }
  if (stored.anonKey) {
    const url = stored.url || env.url || DEFAULT_SUPABASE_URL;
    if (validatePublicKey(stored.anonKey, url).ok)
      return { url, anonKey: stored.anonKey, ownerColumn, source: "local" };
  }
  return null;
}

export function defaultUrl(): string {
  const envUrl = envConfig().url;
  return envUrl ?? DEFAULT_SUPABASE_URL;
}

export function saveConfig(cfg: { url: string; anonKey: string; ownerColumn?: OwnerColumn }) {
  const check = validatePublicKey(cfg.anonKey, cfg.url);
  if (!check.ok) throw new Error(check.reason);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      url: cfg.url.trim().replace(/\/$/, ""),
      anonKey: cfg.anonKey.trim(),
      ownerColumn: cfg.ownerColumn ?? prev?.ownerColumn ?? "owner_id",
    }),
  );
}

export function setOwnerColumn(ownerColumn: OwnerColumn) {
  const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw, ownerColumn }));
}

export function clearConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function maskKey(key: string) {
  return key.length <= 14 ? "•••" : `${key.slice(0, 14)}…${key.slice(-4)}`;
}

// UI preferences only (not business data).
export interface Prefs {
  currency: string;
}
export function readPrefs(): Prefs {
  if (typeof window === "undefined") return { currency: "" };
  try {
    return { currency: "", ...JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return { currency: "" };
  }
}
export function savePrefs(p: Prefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}
