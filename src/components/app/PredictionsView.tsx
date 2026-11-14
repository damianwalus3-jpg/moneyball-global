import { ChevronDown, ChevronUp, Pencil, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, EmptyState, PageHeader, SelectionBadge, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { PredictionForm } from "@/components/forms/PredictionForm";
import { deleteRow, updateRow } from "@/lib/db";
import { hitRate, impliedProbability, isActivePredictionVersion, MARKET_LABELS, PICK_LABELS } from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Market, Prediction } from "@/lib/types";

function sourceLabel(source?: string | null) {
  if (!source) return "brak źródła";
  if (source === "NO_VERIFIED_SOURCE") return "brak potwierdzonych danych";
  if (source === "TIPSAUDIT_FAIR_MARKET") return "rynek fair TipsAudit";
  return source.replace(/_/g, " ");
}

function coverageLabel(coverage?: Record<string, unknown> | null) {
  if (!coverage) return "brak metadanych pokrycia";
  return [
    "historia " + (coverage["verified_history"] ? "✓" : "—"),
    "xG " + (coverage["historical_xg_used"] ? "✓" : "—"),
    "Elo " + (coverage["elo_used"] ? "✓" : "—"),
    "FootyNomad " + (coverage["footynomad_last5"] ? "✓" : "—"),
    "GitHub " + (coverage["keyless_github_last10"] ? "✓" : "—"),
  ].join(" · ");
}

export function PredictionsView({ market }: { market: Market }) {
  const matches = useTable("matches");
  const all = useTable("predictions");
  const couponLegs = useTable("coupon_legs");
  const [verdictFilter, setVerdictFilter] = useState<"all" | "WYBRANY" | "ODRZUCONY">("all");
  const [modelScope, setModelScope] = useState<"current" | "all">("current");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Prediction | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const visible = modelScope === "all"
    ? all
    : all.filter((prediction) => isActivePredictionVersion(prediction.model_version));
  const list = visible
    .filter((prediction) => prediction.market === market)
    .filter((prediction) => verdictFilter === "all" || prediction.verdict === verdictFilter)
    .filter((prediction) => {
      const match = byId.get(prediction.match_id);
      return !query || `${matchLabel(match)} ${match?.competition ?? ""} ${match?.country ?? ""}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => {
      const aMatch = byId.get(a.match_id);
      const bMatch = byId.get(b.match_id);
      return (bMatch?.kickoff_at ?? bMatch?.kickoff_date ?? "").localeCompare(aMatch?.kickoff_at ?? aMatch?.kickoff_date ?? "");
    });
  const settledSelected = visible.filter(
    (prediction) =>
      prediction.market === market &&
      prediction.verdict === "WYBRANY" &&
      prediction.verified &&
      (prediction.settlement_status === "won" || prediction.settlement_status === "lost"),
  );
  const rate = hitRate(settledSelected.map((prediction) => prediction.settlement_status));
  const toggle = useAction((prediction: Prediction) =>
    updateRow("predictions", prediction.id, {
      verdict: prediction.verdict === "ODRZUCONY" ? "WYBRANY" : "ODRZUCONY",
    }),
  );
  const remove = useAction(async (id: string) => {
    if (couponLegs.some((leg) => leg.prediction_id === id))
      throw new Error("Nie można usunąć prognozy użytej w kuponie. Zachowaj historię i zmień werdykt na ODRZUCONY.");
    await deleteRow("predictions", id);
  }, { success: "Usunięto prognozę" });

  return (
    <div>
      <PageHeader
        eyebrow={market === "DOUBLE_CHANCE" ? "1X · X2 · 12" : market === "GOALS" ? "BTTS · OVER / UNDER" : "1 · X · 2"}
        title={MARKET_LABELS[market] === "Gole / BTTS" ? "Prognozy goli" : market === "DOUBLE_CHANCE" ? "Double Chance" : "Prognozy 1X2"}
        description="Prawdopodobieństwo modelu jest oddzielone od kursu bukmachera. Skuteczność obejmuje wyłącznie zweryfikowane rozliczenia."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }} disabled={matches.length === 0}><Plus /> Dodaj prognozę</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Skuteczność WYBRANE" value={fmtPct(rate.rate)} hint={`${rate.won}/${rate.settled} zweryfikowanych`} tone="primary" />
        <StatCard label="Rozliczone" value={rate.settled} />
        <StatCard label="Oczekujące" value={list.filter((prediction) => prediction.settlement_status === "pending").length} />
        <StatCard label="Wszystkie" value={list.length} />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" variant={modelScope === "current" ? "default" : "outline"} onClick={() => setModelScope("current")}>Aktywny model</Button>
        <Button size="sm" variant={modelScope === "all" ? "default" : "outline"} onClick={() => setModelScope("all")}>Wszystkie wersje ({all.length})</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "WYBRANY", "ODRZUCONY"] as const).map((verdict) => (
          <Button key={verdict} size="sm" variant={verdictFilter === verdict ? "default" : "outline"} onClick={() => setVerdictFilter(verdict)}>
            {verdict === "all" ? "Wszystkie" : verdict}
          </Button>
        ))}
        <Input placeholder="Szukaj…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 max-w-xs" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Target} title="Brak prognoz" description={matches.length === 0 ? "Najpierw dodaj mecze lub zaimportuj skan w Terminarzu." : "Dodaj prognozę lub zmień filtry."} />
      ) : (
        <div className="grid gap-2">
          {list.map((prediction) => {
            const match = byId.get(prediction.match_id);
            const implied = impliedProbability(prediction.odds);
            // The displayed odds may come from a provider quote, while market_reference_bookmaker
            // belongs to the separate fair-market probability feed. Never mix those sources.
            const referenceBookmaker = prediction.odds != null
              ? String(prediction.data_coverage?.["odds_bookmaker"] ?? "")
              : "";
            const fairOdds = prediction.data_coverage?.["market_source"] === "TIPSAUDIT_FAIR_MARKET"
              ? prediction.data_coverage["fair_odds"] as { home?: number; draw?: number; away?: number } | null
              : null;
            const fairProb = fairOdds && [fairOdds.home, fairOdds.draw, fairOdds.away].every((value) => Number.isFinite(Number(value)) && Number(value) > 1)
              ? { home: 1 / Number(fairOdds.home), draw: 1 / Number(fairOdds.draw), away: 1 / Number(fairOdds.away) }
              : null;
            const fairSelectionProbability = fairProb
              ? ({ "1": fairProb.home, X: fairProb.draw, "2": fairProb.away, "1X": fairProb.home + fairProb.draw, X2: fairProb.draw + fairProb.away, "12": fairProb.home + fairProb.away } as Record<string, number>)[prediction.selection]
              : null;
            const fairSelectionOdds = fairSelectionProbability != null && fairSelectionProbability > 0 ? 1 / fairSelectionProbability : null;
            return (
              <div key={prediction.id} className="surface-card grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <div className="num flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                  {prediction.selection}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{matchLabel(match)}</div>
                  <div className="mt-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Wybrany typ · {MARKET_LABELS[prediction.market]}</div>
                    <div className="mt-0.5 text-base font-extrabold leading-snug text-foreground sm:text-lg">{prediction.selection === "—" ? "—" : PICK_LABELS[prediction.selection] ?? prediction.selection}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {match?.competition ?? match?.league ?? "—"} · {match?.kickoff_at ? fmtDateTime(match.kickoff_at) : match?.kickoff_date ? match.kickoff_date + " · godzina nieznana" : "brak daty"}
                  </div>
                  <div className="text-xs text-muted-foreground">Źródło: {sourceLabel(prediction.data_source)} · {coverageLabel(prediction.data_coverage)}</div>
                  {fairOdds && <div className="text-xs text-muted-foreground">Kurs fair dla typu: {fmtOdds(fairSelectionOdds)} · 1/X/2: {fmtOdds(fairOdds.home)} / {fmtOdds(fairOdds.draw)} / {fmtOdds(fairOdds.away)} · <a href="https://tipsaudit.com" target="_blank" rel="noreferrer" className="underline">Data: TipsAudit</a> (bez marży, nie jest ofertą bukmachera)</div>}
                  {prediction.probability == null && <div className="text-xs text-warning">Brak wystarczających potwierdzonych danych — prawdopodobieństwo nie zostało wygenerowane.</div>}
                  {prediction.rationale && <div className="text-xs text-muted-foreground">Uzasadnienie: {prediction.rationale}</div>}
                  {prediction.note && !prediction.note.trim().startsWith("{") && <div className="text-xs text-muted-foreground">{prediction.note}</div>}
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 sm:col-span-1 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-sm font-semibold">{fmtPct(prediction.probability)}</span>
                    <span className="num text-xs text-muted-foreground">kurs {fmtOdds(prediction.odds)}{referenceBookmaker && ` · ${referenceBookmaker}`}{implied != null && ` · imp. ${fmtPct(implied)}`}</span>
                    <button onClick={() => toggle.mutate(prediction)} title="Przełącz werdykt"><SelectionBadge status={prediction.verdict} /></button>
                    <SettlementBadge status={prediction.settlement_status} />
                    {prediction.verified && <span className="text-xs text-success">zweryfikowano</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setExpandedId(expandedId === prediction.id ? null : prediction.id)}>
                      {expandedId === prediction.id ? <ChevronUp /> : <ChevronDown />} Szczegóły
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Edytuj" title={couponLegs.some((leg) => leg.prediction_id === prediction.id) ? "Prognoza jest użyta w kuponie" : "Edytuj"} disabled={couponLegs.some((leg) => leg.prediction_id === prediction.id)} onClick={() => { setEditing(prediction); setOpen(true); }}><Pencil /></Button>
                    {!couponLegs.some((leg) => leg.prediction_id === prediction.id) && <ConfirmDelete onConfirm={() => remove.mutate(prediction.id)} />}
                  </div>
                </div>
                {expandedId === prediction.id && (
                  <div className="col-span-2 grid gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="eyebrow mb-1">Dlaczego taki typ?</div>
                      <p className="whitespace-pre-wrap break-words">{prediction.rationale || "Silnik nie zapisał szczegółowego uzasadnienia dla tej prognozy."}</p>
                      {prediction.note && !prediction.note.trim().startsWith("{") && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{prediction.note}</p>}
                    </div>
                    <div className="grid content-start gap-2">
                      <div><span className="eyebrow">Model</span><p className="break-words">{prediction.model_version}</p></div>
                      <div><span className="eyebrow">Poziom pewności</span><p>{prediction.confidence || "nie podano"}</p></div>
                      <div><span className="eyebrow">Źródła i pokrycie</span><p className="break-words">{sourceLabel(prediction.data_source)} · {coverageLabel(prediction.data_coverage)}</p></div>
                      <div><span className="eyebrow">Rynek / kurs</span><p>{MARKET_LABELS[prediction.market]} · {prediction.selection} · {fmtOdds(prediction.odds)}{referenceBookmaker ? ` · ${referenceBookmaker}` : ""}</p></div>
                      {Boolean(prediction.data_coverage?.["odds_price_timestamp"]) && <div><span className="eyebrow">Aktualizacja kursu</span><p>{fmtDateTime(String(prediction.data_coverage?.["odds_price_timestamp"]))} · kurs z chwili pobrania u bukmachera</p></div>}
                      {prediction.verdict === "WYBRANY" && (() => {
                        const stake = Number(prediction.stake ?? 5);
                        const potentialReturn = prediction.potential_return != null
                          ? Number(prediction.potential_return)
                          : prediction.odds != null && Number(prediction.odds) > 1
                            ? Math.round(stake * Number(prediction.odds) * 100) / 100
                            : null;
                        const potentialProfit = potentialReturn == null ? null : Math.round((potentialReturn - stake) * 100) / 100;
                        return (
                          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:col-span-2">
                            <div className="eyebrow mb-2">Rozliczenie pojedynczego typu · stała stawka</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div><span className="text-xs text-muted-foreground">Stawka</span><p className="num font-semibold">{fmtMoney(stake)}</p></div>
                              <div><span className="text-xs text-muted-foreground">Możliwy zwrot</span><p className="num font-semibold">{fmtMoney(potentialReturn)}</p></div>
                              <div><span className="text-xs text-muted-foreground">Możliwy zysk netto</span><p className="num font-semibold text-success">{fmtMoney(potentialProfit)}</p></div>
                              <div><span className="text-xs text-muted-foreground">Wynik rozliczenia</span><p className={prediction.profit_loss != null && prediction.profit_loss > 0 ? "num font-semibold text-success" : prediction.profit_loss != null && prediction.profit_loss < 0 ? "num font-semibold text-destructive" : "num font-semibold"}>{prediction.verified ? fmtMoney(prediction.profit_loss) : "Oczekuje na wynik"}</p></div>
                            </div>
                            {prediction.odds == null && <p className="mt-2 text-xs text-warning">Brak zapisanego kursu — potencjalna wypłata i zysk nie są wyliczane.</p>}
                          </div>
                        );
                      })()}
                      <div><span className="eyebrow">Mecz / termin</span><p>{match?.competition ?? match?.league ?? "Rozgrywki niepodane"} · {match?.kickoff_at ? fmtDateTime(match.kickoff_at) : match?.kickoff_date ?? "Termin nieznany"}</p></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <PredictionForm open={open} onOpenChange={setOpen} market={market} prediction={editing} matches={matches} />
    </div>
  );
}
