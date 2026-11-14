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
      setErr("Brak połączenia z bazą. Wróć do aplikacji i sprawdź konfigurację.");
      setChecking(false);
      return;
    }

    let active = true;
    let recoveryConfirmed = false;
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const authError = query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error");
    const tokenHash = query.get("token_hash");
    const tokenType = query.get("type");
    const code = query.get("code");
    const hashRecovery = hash.get("type") === "recovery";

    const showError = (message: string) => {
      if (!active) return;
      setErr(message);
      setReady(false);
      setChecking(false);
    };

    const acceptRecovery = () => {
      if (!active) return;
      recoveryConfirmed = true;
      setErr("");
      setReady(true);
      setChecking(false);
    };

    if (authError) {
      showError(decodeURIComponent(authError.replace(/\+/g, " ")));
      return () => { active = false; };
    }

    // PKCE recovery links can carry a one-time code in the query string.
    // Some Supabase email templates instead provide token_hash + type=recovery.
    const subscription = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        acceptRecovery();
      } else if (hashRecovery && session) {
        // The implicit-flow token is accepted only when the URL explicitly marks
        // this session as a password-recovery flow.
        acceptRecovery();
      }
    });

    const verifyLink = async () => {
      try {
        if (tokenHash && tokenType === "recovery") {
          const { error } = await sb.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          acceptRecovery();
          return;
        }

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
          // Recovery code exchange emits PASSWORD_RECOVERY. Do not accept a
          // normal signed-in session as proof that a reset link was used.
          if (!recoveryConfirmed && active) {
            showError("Link otworzył sesję, ale nie potwierdził operacji resetowania hasła. Wyślij nowy link.");
          }
          return;
        }

        if (hashRecovery) {
          const { data, error } = await sb.auth.getSession();
          if (error) throw error;
          if (data.session) {
            acceptRecovery();
            return;
          }
        }

        if (!recoveryConfirmed && active) {
          showError("Ten link nie jest prawidłowym linkiem resetowania hasła albo wygasł. Wróć do logowania i wyślij nowy.");
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Nie udało się zweryfikować linku.";
        showError(/expired|invalid|otp|token|code verifier/i.test(message)
          ? "Link resetujący jest nieprawidłowy, wygasł lub został już użyty. Wyślij nowy link."
          : message);
      }
    };

    void verifyLink();
    const timeout = window.setTimeout(() => {
      if (active && !recoveryConfirmed && checking) {
        showError("Nie udało się potwierdzić linku. Wyślij nowy link resetujący.");
      }
    }, 12000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.data.subscription.unsubscribe();
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
      toast.success("Hasło zostało zmienione.");
      await sb.auth.signOut();
      await navigate({ to: "/login", replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Nie udało się zmienić hasła.";
      setErr(/expired|invalid|otp|token|session/i.test(message)
        ? "Sesja resetowania wygasła. Wyślij nowy link resetujący."
        : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <div className="surface-card p-6">
          <h1 className="text-3xl font-bold uppercase">Nowe hasło</h1>
          {checking && !ready ? (
            <p className="mt-3 text-sm text-muted-foreground">Weryfikacja linku odzyskiwania hasła…</p>
          ) : ready ? (
            <form onSubmit={submit} className="mt-5 grid gap-4">
              <Field label="Nowe hasło" htmlFor="pw">
                <Input id="pw" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label="Powtórz hasło" htmlFor="pw2">
                <Input id="pw2" type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
              {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz nowe hasło"}</Button>
            </form>
          ) : (
            <div className="mt-4 grid gap-3">
              {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
              <Button type="button" onClick={() => navigate({ to: "/login" })}>Wróć do logowania</Button>
              <Link to="/login" className="text-center text-sm text-primary underline">Wyślij ponownie link resetujący</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
