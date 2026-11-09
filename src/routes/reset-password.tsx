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
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    sb.auth.getSession().then(({ data: d }) => d.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setErr("Hasło musi mieć co najmniej 6 znaków.");
    if (pw !== pw2) return setErr("Hasła się różnią.");
    setBusy(true);
    const { error } = await getSupabase()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    toast.success("Hasło zmienione");
    navigate({ to: "/panel" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="surface-card p-6">
          <h1 className="text-3xl font-bold uppercase">Nowe hasło</h1>
          {!ready ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Otwórz tę stronę z linku w wiadomości e-mail. Weryfikacja linku…
            </p>
          ) : (
            <form onSubmit={submit} className="mt-5 grid gap-4">
              <Field label="Nowe hasło" htmlFor="pw">
                <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label="Powtórz hasło" htmlFor="pw2" error={err}>
                <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy}>
                Zapisz hasło
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
