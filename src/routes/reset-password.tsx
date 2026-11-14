import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/app/AppShell";
import { Field } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nowe hasło — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Ustaw nowe hasło do panelu MONEYBALL GLOBAL 2.0." },
      { property: "og:title", content: "Nowe hasło — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Ustaw nowe hasło do panelu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setErr("Brak połączenia z bazą. Otwórz aplikację ponownie.");
      setChecking(false);
      return;
    }

    let active = true;
    const finish = (ok: boolean, message = "") => {
      if (!active) return;
      setReady(ok);
      setErr(message);
      setChecking(false);
    };

    const subscription = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") finish(true);
    }).data.subscription;

    const url = new URL(window.location.href);
    const queryError = url.searchParams.get("error_description") || url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const tokenType = url.searchParams.get("type");
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const hashType = hash.get("type");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    const cleanUrl = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    const verify = async () => {
      try {
        if (queryError) throw new Error(queryError.replace(/\+/g, " "));

        // Backward compatibility for recovery emails sent before the SPA switched to implicit tokens.
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
          cleanUrl();
          finish(true);
          return;
        }

        if (tokenHash && tokenType === "recovery") {
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
          cleanUrl();
          finish(true);
          return;
        }

        if (hashType === "recovery" && accessToken && refreshToken) {
          const { error } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          cleanUrl();
          finish(true);
          return;
        }

        finish(false, "Link odzyskiwania jest nieprawidłowy lub wygasł. Wróć do logowania i wyślij nową prośbę o reset hasła.");
      } catch (e) {
        finish(false, e instanceof Error ? e.message : "Nie udało się zweryfikować linku odzyskiwania.");
      }
    };

    void verify();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!ready) return setErr("Najpierw otwórz i zweryfikuj link odzyskiwania hasła.");
    if (pw.length < 12) return setErr("Ustaw hasło o długości co najmniej 12 znaków.");
    if (pw.length > 128) return setErr("Hasło może mieć maksymalnie 128 znaków.");
    if (pw !== pw2) return setErr("Hasła się różnią.");

    const sb = getSupabase();
    if (!sb) return setErr("Brak połączenia z bazą.");

    setBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Hasło zostało zmienione. Zaloguj się nowym hasłem.");
      await sb.auth.signOut();
      navigate({ to: "/login", replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się zapisać nowego hasła. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <div className="surface-card p-6">
          <h1 className="text-3xl font-bold uppercase">Ustaw nowe hasło</h1>
          {checking ? (
            <p className="mt-3 text-sm text-muted-foreground">Weryfikuję bezpieczny link odzyskiwania…</p>
          ) : !ready ? (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-destructive">{err}</p>
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/login" })}>Wróć do logowania</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 grid gap-4">
              <p className="text-sm text-muted-foreground">Link został potwierdzony. Ustaw nowe hasło — nie wpisuj dotychczasowego.</p>
              <Field label="Nowe hasło (minimum 12 znaków)" htmlFor="pw">
                <Input id="pw" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label="Powtórz nowe hasło" htmlFor="pw2" error={err}>
                <Input id="pw2" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz nowe hasło"}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
