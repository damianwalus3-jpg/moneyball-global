import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Flag, History } from "lucide-react";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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
import { fmtMoney, fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { ensureTables, historyPagesQuery } from "@/lib/queries";
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
  loader: ({ context }) => Promise.all([
    context.queryClient.prefetchInfiniteQuery(historyPagesQuery({ tab: "todo", search: "" })),
    ensureTables(context.queryClient, ["match_results", "coupons", "coupon_legs"]),
  ]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Historia,
});

const isVoided = (match: Match) => match.status === "cancelled" || match.status === "postponed";

function Historia() {
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [q, setQ] = useState("");
  const [settle, setSettle] = useState<Match | null>(null);
  const pageQuery = useInfiniteQuery(historyPagesQuery({ tab, search: q }));
  const list = pageQuery.data?.pages.flatMap((page) => page.rows) ?? [];
  const summary = pageQuery.data?.pages[0];

  return (
    <div>
      <PageHeader
        eyebrow="Wyniki · rozliczenia"
        title="Historia / Rozliczenia"
        description="Wyniki meczów, zwroty za przełożone/odwołane spotkania oraz rozliczenia prognoz i kuponów. Poprawienie wyniku przelicza rozliczenie ponownie."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === "todo" ? "default" : "outline"} onClick={() => setTab("todo")}>
          Do rozliczenia ({summary?.todo_count ?? 0})
        </Button>
        <Button size="sm" variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>
          Rozliczone ({summary?.done_count ?? 0})
        </Button>
        <Input placeholder="Szukaj…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
      </div>

      {pageQuery.isPending ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">Ładowanie historii…</div>
      ) : pageQuery.isError ? (
        <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-destructive">Nie udało się pobrać historii: {pageQuery.error.message}</span>
          <Button size="sm" variant="outline" onClick={() => pageQuery.refetch()}>Spróbuj ponownie</Button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "todo" ? CheckCircle2 : History}
          title={tab === "todo" ? "Nic do rozliczenia" : "Brak zweryfikowanych wyników"}
          description={
            tab === "todo"
              ? "Tutaj trafiają rozpoczęte mecze bez zweryfikowanego wyniku. Przełożone i odwołane spotkania ze zwrotem są w historii."
              : "Tutaj są zweryfikowane wyniki oraz przełożone/odwołane mecze rozliczone jako zwrot."
          }
        />
      ) : (
        <div className="grid gap-2">
          {list.map(({ match: m, result: r, predictions: mp }) => {
            return (
              <div key={m.id} className="surface-card p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{matchLabel(m)}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.competition ?? "—"} · {fmtDateTime(m.kickoff_at)}
                    </div>
                  </div>
                  {r ? (
                    <div className="rounded-md bg-secondary px-2 py-1 text-right">
                      <div className="num text-lg font-semibold">
                        {r.home_score == null || r.away_score == null ? "ZWROT" : String(r.home_score) + ":" + String(r.away_score)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{r.verified ? "zweryfikowano" : "do weryfikacji"}</div>
                    </div>
                  ) : isVoided(m) ? (
                    <SettlementBadge status="void" />
                  ) : null}
                  <Button size="sm" variant={r ? "outline" : "default"} onClick={() => setSettle(m)}>
                    <Flag /> {isVoided(m) ? "Zwrot" : r ? "Popraw wynik" : "Wpisz wynik"}
                  </Button>
                </div>
                {mp.length > 0 && (
                  <div className="mt-2 grid gap-1 border-t border-border pt-2">
                    {mp.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <TypeBadge type={p.market} />
                        <span className="num w-7 font-semibold text-primary">{p.selection}</span>
                        <span className="num text-xs text-muted-foreground">{fmtPct(p.probability)}</span>
                        <SelectionBadge status={p.verdict} />
                        <span className="flex-1" />
                        {p.verdict === "WYBRANY" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">Stawka {fmtMoney(p.stake ?? 4)} · kurs {fmtOdds(p.odds)} · możliwy zwrot {fmtMoney(p.potential_return ?? (p.odds != null ? 4 * Number(p.odds) : null))}</span>
                            <SettlementBadge status={p.settlement_status} />
                            {p.verified && <span className={p.profit_loss != null && p.profit_loss > 0 ? "text-xs font-semibold text-success" : p.profit_loss != null && p.profit_loss < 0 ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"}>Wynik {fmtMoney(p.profit_loss)}</span>}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Nie obstawiono · bez rozliczenia</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {pageQuery.hasNextPage && (
            <div className="flex justify-center py-3">
              <Button variant="outline" onClick={() => pageQuery.fetchNextPage()} disabled={pageQuery.isFetching}>
                {pageQuery.isFetchingNextPage ? "Wczytywanie…" : "Wczytaj kolejne 30"}
              </Button>
            </div>
          )}
        </div>
      )}
      <SettleMatchDialog match={settle} onClose={() => setSettle(null)} />
    </div>
  );
}
