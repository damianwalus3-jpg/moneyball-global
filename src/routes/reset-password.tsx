import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
      setChecking(false);
      setErr("Brak połączenia z bazą. Wróć do aplikacji i sprawdź konfigurację.");
      return;
    }

    let active = true;
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryError = params.get("error_description") || hash.get("error_description");
    const hasRecoveryPayload =
      params.has("code") ||
      hash.get("type") === "recovery" ||
      hash.has("access_token") ||
      hash.has("token_hash");

    if (recoveryError) {
      setErr(decodeURIComponent(recoveryError.replace(/\+/g, " ")));
      setChecking(false);
    }

    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (hasRecoveryPayload && session)) {
        setReady(true);
        setErr("");
      }
      if (event === "SIGNED_OUT" && !ready) {
        setReady(false);
      }
      setChecking(false);
    });

    // Supabase may finish exchanging the recovery token before the listener is attached.
    sb.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active) return;
      if (error) {
        setErr("Nie udało się zweryfikować linku. Poproś o nowy link resetujący.");
      } else if (sessionData.session && hasRecoveryPayload) {
        setReady(true);
        setErr("");
      } else if (!hasRecoveryPayload && !recoveryError) {
        setErr("Ten adres nie zawiera linku odzyskiwania hasła. Wróć do logowania i wyślij nowy link.");
      }
      setChecking(false);
    }).catch(() => {
      if (!active) return;
      setErr("Nie udało się zweryfikować linku. Sprawdź połączenie i poproś o nowy link.");
      setChecking(false);
    });

    const timeout = window.setTimeout(() => {
      if (active && !ready && !recoveryError) {
        setChecking(false);
        setErr("Link nie został potwierdzony. Mógł wygasnąć lub został już użyty. Wyślij nowy link resetujący.");
      }
    }, 10000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("Hasło musi mieć co najmniej 8 znaków.");
    if (pw !== pw2) return setErr("Hasła się różnią.");
    const sb = getSupabase();
    if (!sb) return setErr("Brak połączenia z bazą. Odśwież stronę i spróbuj ponownie.");

    setBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Hasło zostało zmienione. Możesz się zalogować.");
      await sb.auth.signOut();
      navigate({ to: "/login" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zmienić hasła.";
      setErr(
        /expired|invalid|otp|token/i.test(message)
          ? "Link resetujący jest nieprawidłowy lub wygasł. Wyślij nowy link."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="surface-card p-6">
          <h1 className="text-3xl font-bold uppercase">Nowe hasło</h1>
          {checking && !ready ? (
            <p className="mt-3 text-sm text-muted-foreground">Weryfikacja linku odzyskiwania hasła…</p>
          ) : ready ? (
            <form onSubmit={submit} className="mt-5 grid gap-4">
              <Field label="Nowe hasło" htmlFor="pw">
                <Input id="pw" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label="Powtórz hasło" htmlFor="pw2" error={err}>
                <Input id="pw2" type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy ? "Zapisywanie…" : "Zapisz nowe hasło"}
              </Button>
            </form>
          ) : (
            <div className="mt-4 grid gap-3">
              {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
              <Button type="button" onClick={() => navigate({ to: "/login" })}>
                Wróć do logowania
              </Button>
              <Link to="/login" className="text-center text-sm text-primary underline">
                Wyślij ponownie link resetujący
              </Link>
            </div>
          )}
          {ready && err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}
