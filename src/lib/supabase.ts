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
        // Use implicit recovery tokens so a password-reset link also works when
        // the email is opened in a different browser/webview than the one that
        // requested it. The /reset-password route validates the recovery type
        // and installs the temporary session explicitly; it never treats an
        // arbitrary existing session as proof of a recovery link.
        // Keep URL handling manual so the router cannot consume the tokens first.
        flowType: "implicit",
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
