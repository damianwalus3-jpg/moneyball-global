import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readConfig } from "./config";

let client: SupabaseClient | null = null;
let clientKey = "";

/** Browser-only Supabase client for the owner's existing project. RLS applies to every query. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const cfg = readConfig();
  if (!cfg) return null;
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Supabase password recovery supports PKCE. The recovery route exchanges
        // the one-time ?code= explicitly after the user lands on /reset-password.
        // Disable automatic URL handling so the router cannot consume the code first.
        flowType: "pkce",
        detectSessionInUrl: false,
        storageKey: "moneyball-auth",
      },
    });
    clientKey = key;
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("Brak konfiguracji połączenia z bazą. Przejdź do ekranu konfiguracji.");
  return c;
}

export function resetSupabase() {
  client = null;
  clientKey = "";
}
