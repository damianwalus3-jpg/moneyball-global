import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/app/AppShell";
import { Field } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultUrl, readConfig, saveConfig, validatePublicKey, validateSupabaseUrl, maskKey } from "@/lib/config";
import { resetSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Konfiguracja połączenia — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Połącz aplikację z istniejącym projektem bazy danych za pomocą klucza publicznego." },
      { property: "og:title", content: "Konfiguracja połączenia — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Połącz aplikację z istniejącym projektem bazy danych." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Setup,
});

function Setup() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(defaultUrl());
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ url?: string | undefined; key?: string | undefined }>({});
  const [testing, setTesting] = useState(false);
  const [current, setCurrent] = useState<ReturnType<typeof readConfig>>(null);

  useEffect(() => setCurrent(readConfig()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const urlErr = validateSupabaseUrl(url) ?? undefined;
    const check = validatePublicKey(key, url);
    const keyErr = check.ok ? undefined : check.reason;
    setErr({ url: urlErr, key: keyErr });
    if (urlErr || keyErr) return;
    setTesting(true);
    try {
      const res = await fetch(`${url.trim().replace(/\/$/, "")}/auth/v1/settings`, {
        headers: { apikey: key.trim() },
      });
      if (res.status === 401 || res.status === 403) throw new Error("Klucz odrzucony przez serwer. Sprawdź, czy jest poprawny.");
      if (!res.ok) throw new Error(`Serwer odpowiedział kodem ${res.status}.`);
      saveConfig({ url, anonKey: key });
      resetSupabase();
      toast.success("Połączono z bazą");
      navigate({ to: "/login" });
    } catch (e) {
      setErr({ key: e instanceof Error ? e.message : "Nie udało się połączyć." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="surface-card p-6">
          <div className="eyebrow text-primary">Krok 1 z 2</div>
          <h1 className="mt-1 text-3xl font-bold uppercase">Połączenie z bazą</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aplikacja korzysta z Twojego istniejącego projektu. Wklej tylko <strong>klucz publiczny</strong>{" "}
            (publishable / anon). Dostęp do danych chronią reguły RLS i Twoje logowanie.
          </p>

          {current?.source === "env" && (
            <div className="mt-4 rounded-lg border border-info/40 bg-info/10 p-3 text-sm">
              Klucz jest już ustawiony w zmiennych środowiskowych ({maskKey(current.anonKey)}).{" "}
              <Link to="/login" className="font-semibold text-primary underline">
                Przejdź do logowania
              </Link>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="Adres projektu" htmlFor="url" error={err.url}>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
            </Field>
            <Field
              label="Klucz publishable / anon"
              htmlFor="key"
              error={err.key}
              hint="Panel bazy → Project Settings → API Keys → Publishable key (lub „anon public”)."
            >
              <div className="relative">
                <Input
                  id="key"
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sb_publishable_… lub eyJhbGciOi…"
                  autoComplete="off"
                  className="pr-10 num"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? "Ukryj klucz" : "Pokaż klucz"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
              <ShieldAlert className="size-4 shrink-0 text-destructive" />
              <span>
                Nigdy nie wklejaj klucza <strong>secret</strong> ani <strong>service_role</strong>. Aplikacja
                automatycznie je odrzuca.
              </span>
            </div>
            <Button type="submit" size="lg" disabled={testing}>
              {testing ? <Loader2 className="animate-spin" /> : <KeyRound />} Sprawdź i zapisz
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Klucz publiczny zapisywany jest tylko na tym urządzeniu. Wszystkie dane biznesowe trafiają do bazy.
        </p>
      </div>
    </div>
  );
}
