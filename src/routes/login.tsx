import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/app/AppShell";
import { Field } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase, requireSupabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("//") ? s["redirect"] : undefined,
  }),
  beforeLoad: async () => {
    const sb = getSupabase();
    if (!sb) throw redirect({ to: "/setup" });
    const { data } = await sb.auth.getSession();
    if (data.session) throw redirect({ to: "/panel" });
  },
  head: () => ({
    meta: [
      { title: "Logowanie — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Zaloguj się do prywatnego panelu prognoz MONEYBALL GLOBAL 2.0." },
      { property: "og:title", content: "Logowanie — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Zaloguj się do prywatnego panelu prognoz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const search = Route.useSearch();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Podaj prawidłowy adres e-mail.");
    if (mode !== "forgot" && password.length < 6) return setError("Hasło musi mieć co najmniej 6 znaków.");
    setBusy(true);
    try {
      const sb = requireSupabase();
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Nieprawidłowy e-mail lub hasło." : error.message);
        toast.success("Zalogowano");
        router.history.push(search.redirect ?? "/panel");
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/panel" },
        });
        if (error) throw new Error(error.message);
        if (data.session) router.history.push("/panel");
        else setInfo("Sprawdź skrzynkę e-mail i potwierdź konto, a potem zaloguj się.");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw new Error(error.message);
        setInfo("Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Wystąpił błąd.";
      if (/invalid login credentials|invalid_credentials/i.test(message)) {
        setError("Nieprawidłowy e-mail lub hasło. Sprawdź dane logowania do właściwego konta MONEYBALL.");
      } else if (/email not confirmed/i.test(message)) {
        setError("Adres e-mail nie został jeszcze potwierdzony. Otwórz wiadomość potwierdzającą konto.");
      } else if (/over_email_send_rate_limit|email rate limit exceeded/i.test(message)) {
        setError("Limit wysyłania e-maili został osiągnięty. Poczekaj, zanim ponowisz reset hasła.");
      } else if (/too many requests|rate limit/i.test(message)) {
        setError("Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.");
      } else if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
        setError("Nie udało się połączyć z serwerem logowania. Sprawdź internet i spróbuj ponownie.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = { login: "Logowanie", signup: "Nowe konto", forgot: "Reset hasła" };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="surface-card p-6">
          <h1 className="text-3xl font-bold uppercase">{titles[mode]}</h1>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="E-mail" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {mode !== "forgot" && (
              <Field label="Hasło" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
              {mode === "login" ? "Zaloguj" : mode === "signup" ? "Utwórz konto" : "Wyślij link"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col gap-1 text-sm">
            {mode !== "login" && (
              <button className="text-left text-primary" onClick={() => setMode("login")}>
                ← Wróć do logowania
              </button>
            )}
            {mode === "login" && (
              <>
                <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                  Nie pamiętasz hasła?
                </button>
                <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>
                  Nie masz konta? Utwórz je
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/setup" className="underline">
            Zmień połączenie z bazą
          </Link>
        </p>
      </div>
    </div>
  );
}
