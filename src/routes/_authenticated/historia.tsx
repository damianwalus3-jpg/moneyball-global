import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Flag, History } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataError,
  EmptyState,
  PageHeader,
  PageLoader,
  SelectionBadge,
  SettlementBadge,
  TypeBadge,
} from "@/components/app/ui-bits";
import { SettleMatchDialog } from "@/components/app/SettleMatchDialog";
import { fmtPct, matchLabel } from "@/lib/format";
import { ensureTables, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Match } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/historia")({
  head: () => ({
    meta: [
      { title: "Historia i rozliczenia — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Wpisywanie wyników i automatyczne rozliczanie prognoz 1X2, Double Chance i kuponów." },
      { property: "og:title", content: "Historia i rozliczenia — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Wyniki meczów i rozliczenia prognoz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    ensureTables(context.queryClient, ["matches", "predictions", "match_results", "coupons", "coupon_legs"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Historia,
});

function Historia() {
  const matches = useTable("matches");
  const preds = useTable("predictions");
  const results = useTable("match_results");
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [q, setQ] = useState("");
  const [settle, setSettle] = useState<Match | null>(null);
  const resultBy = useMemo(() => new Map(results.map((r) => [r.match_id, r])), [results]);
  const now = Date.now();

  const isVoided = (m: Match) => m.status === "cancelled" || m.status === "postponed";
  const todo = matches
    .filter((m) => m.kickoff_at && new Date(m.kickoff_at).getTime() < now && !resultBy.has(m.id) && !isVoided(m))
    .sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""));
  const done = matches
    .filter((m) => resultBy.has(m.id) || isVoided(m))
    .sort((a, b) => (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? ""));
  const list = (tab === "todo" ? todo : done).filter(
    (m) => !q || `${matchLabel(m)} ${m.league}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Wyniki · rozliczenia"
        title="Historia / Rozliczenia"
        description="Wpisz wynik, a aplikacja rozliczy wszystkie prognozy 1X2 i DC tego meczu oraz powiązane kupony. Poprawienie wyniku rozlicza wszystko ponownie."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === "todo" ? "default" : "outline"} onClick={() => setTab("todo")}>
          Do rozliczenia ({todo.length})
        </Button>
        <Button size="sm" variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>
          Rozliczone ({done.length})
        </Button>
        <Input placeholder="Szukaj…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={tab === "todo" ? CheckCircle2 : History}
          title={tab === "todo" ? "Nic do rozliczenia" : "Brak rozliczonych meczów"}
          description={
            tab === "todo"
              ? "Mecze pojawią się tutaj po godzinie rozpoczęcia, jeśli nie mają jeszcze wyniku."
              : "Po wpisaniu wyniku mecz trafi do historii."
          }
        />
      ) : (
        <div className="grid gap-2">
          {list.map((m) => {
            const r = resultBy.get(m.id);
            const mp = preds.filter((p) => p.match_id === m.id);
            return (
              <div key={m.id} className="surface-card p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{matchLabel(m)}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.league ?? "—"} · {fmtDateTime(m.kickoff_at)}
                    </div>
                  </div>
                  {r ? (
                    <div className="num rounded-md bg-secondary px-2 py-1 text-lg font-semibold">
                      {r.home_goals}:{r.away_goals}
                    </div>
                  ) : isVoided(m) ? (
                    <SettlementBadge status="void" />
                  ) : null}
                  <Button size="sm" variant={r ? "outline" : "default"} onClick={() => setSettle(m)}>
                    <Flag /> {r || isVoided(m) ? "Popraw" : "Wpisz wynik"}
                  </Button>
                </div>
                {mp.length > 0 && (
                  <div className="mt-2 grid gap-1 border-t border-border pt-2">
                    {mp.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <TypeBadge type={p.prediction_type} />
                        <span className="num w-7 font-semibold text-primary">{p.pick}</span>
                        <span className="num text-xs text-muted-foreground">{fmtPct(p.probability)}</span>
                        <SelectionBadge status={p.selection_status} />
                        <span className="flex-1" />
                        <SettlementBadge status={p.result_status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <SettleMatchDialog match={settle} onClose={() => setSettle(null)} />
    </div>
  );
}
