import { Pencil, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, EmptyState, PageHeader, SelectionBadge, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { PredictionForm } from "@/components/forms/PredictionForm";
import { deleteRow, updateRow } from "@/lib/db";
import { ACTIVE_MODEL_VERSION, hitRate, impliedProbability } from "@/lib/domain";
import { fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Prediction, PredictionType } from "@/lib/types";

export function PredictionsView({ type }: { type: PredictionType }) {
  const matches = useTable("matches");
  const all = useTable("predictions");
  const [sel, setSel] = useState<"all" | "WYBRANY" | "ODRZUCONY">("all");
  const [modelScope, setModelScope] = useState<"current" | "all">("current");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Prediction | null>(null);
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const visible = modelScope === "all" ? all : all.filter((p) => p.model_version === ACTIVE_MODEL_VERSION || !p.data_source);
  const list = visible
    .filter((p) => p.prediction_type === type)
    .filter((p) => sel === "all" || p.selection_status === sel)
    .filter((p) => {
      const m = byId.get(p.match_id);
      return !q || `${matchLabel(m)} ${m?.league ?? ""}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => (byId.get(b.match_id)?.kickoff_at ?? "").localeCompare(byId.get(a.match_id)?.kickoff_at ?? ""));
  const hr = hitRate(visible.filter((p) => p.prediction_type === type && p.selection_status === "WYBRANY").map((p) => p.result_status));
  const toggle = useAction((p: Prediction) =>
    updateRow("predictions", p.id, { selection_status: p.selection_status === "ODRZUCONY" ? "WYBRANY" : "ODRZUCONY" }),
  );
  const del = useAction((id: string) => deleteRow("predictions", id), { success: "Usunięto prognozę" });
  const title = type === "DC" ? "Double Chance" : "Prognozy 1X2";

  return (
    <div>
      <PageHeader
        eyebrow={type === "DC" ? "1X · X2 · 12" : "1 · X · 2"}
        title={title}
        description="Prawdopodobieństwo modelu jest zapisywane osobno od kursu bukmachera."
        actions={
          <Button onClick={() => { setEdit(null); setOpen(true); }} disabled={matches.length === 0}>
            <Plus /> Dodaj prognozę
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Skuteczność (WYBRANE)" value={fmtPct(hr.rate)} hint={`${hr.won}/${hr.settled} rozliczonych`} tone="primary" />
        <StatCard label="Oczekujące" value={hr.pending} />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" variant={modelScope === "current" ? "default" : "outline"} onClick={() => setModelScope("current")}>
          Aktywny model 3.8
        </Button>
        <Button size="sm" variant={modelScope === "all" ? "default" : "outline"} onClick={() => setModelScope("all")}>
          Wszystkie wersje ({all.length})
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "WYBRANY", "ODRZUCONY"] as const).map((s) => (
          <Button key={s} size="sm" variant={sel === s ? "default" : "outline"} onClick={() => setSel(s)}>
            {s === "all" ? "Wszystkie" : s}
          </Button>
        ))}
        <Input placeholder="Szukaj…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Brak prognoz"
          description={matches.length === 0 ? "Najpierw dodaj mecze lub zaimportuj skan w Terminarzu." : "Dodaj prognozę lub zmień filtry."}
        />
      ) : (
        <div className="grid gap-2">
          {list.map((p) => {
            const m = byId.get(p.match_id);
            const imp = impliedProbability(p.odds);
            return (
              <div key={p.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
                <div className="num flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">{p.pick}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{matchLabel(m)}</div>
                  <div className="text-xs text-muted-foreground">{m?.league ?? "—"} · {fmtDateTime(m?.kickoff_at)}</div>
                  {p.rejection_reason && <div className="text-xs text-muted-foreground">Powód: {p.rejection_reason}</div>}
                </div>
                <div className="num text-right text-sm">
                  <div>{fmtPct(p.probability)}</div>
                  <div className="text-xs text-muted-foreground">kurs {fmtOdds(p.odds)}{imp != null && ` · imp. ${fmtPct(imp)}`}</div>
                </div>
                <button onClick={() => toggle.mutate(p)} title="Przełącz status"><SelectionBadge status={p.selection_status} /></button>
                <SettlementBadge status={p.result_status} />
                <Button variant="ghost" size="icon" aria-label="Edytuj" onClick={() => { setEdit(p); setOpen(true); }}><Pencil /></Button>
                <ConfirmDelete onConfirm={() => del.mutate(p.id)} />
              </div>
            );
          })}
        </div>
      )}
      <PredictionForm open={open} onOpenChange={setOpen} type={type} prediction={edit} matches={matches} />
    </div>
  );
}
