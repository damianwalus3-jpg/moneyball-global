import type { TableName } from "./types";

// The column contract the app reads and writes. Diagnostics compares the live
// database with this list; the generated SQL only ADDs what is missing.
export interface ColumnDef {
  name: string;
  sql: string;
}

export const SCHEMA: Record<TableName, ColumnDef[]> = {
  scan_runs: [
    { name: "started_at", sql: "timestamptz default now()" },
    { name: "source", sql: "text" },
    { name: "notes", sql: "text" },
    { name: "matches_count", sql: "integer" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  matches: [
    { name: "scan_run_id", sql: "uuid references public.scan_runs(id) on delete set null" },
    { name: "kickoff_at", sql: "timestamptz" },
    { name: "league", sql: "text" },
    { name: "country", sql: "text" },
    { name: "home_team", sql: "text" },
    { name: "away_team", sql: "text" },
    { name: "status", sql: "text default 'scheduled'" },
    { name: "external_id", sql: "text" },
    { name: "notes", sql: "text" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  predictions: [
    { name: "match_id", sql: "uuid references public.matches(id) on delete cascade" },
    { name: "scan_run_id", sql: "uuid references public.scan_runs(id) on delete set null" },
    { name: "prediction_type", sql: "text" },
    { name: "pick", sql: "text" },
    { name: "probability", sql: "numeric" },
    { name: "confidence", sql: "text" },
    { name: "odds", sql: "numeric" },
    { name: "selection_status", sql: "text default 'WYBRANY'" },
    { name: "rejection_reason", sql: "text" },
    { name: "result_status", sql: "text default 'pending'" },
    { name: "settled_at", sql: "timestamptz" },
    { name: "notes", sql: "text" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  coupons: [
    { name: "name", sql: "text" },
    { name: "batch_id", sql: "text" },
    { name: "stake", sql: "numeric" },
    { name: "total_odds", sql: "numeric" },
    { name: "combined_probability", sql: "numeric" },
    { name: "status", sql: "text default 'pending'" },
    { name: "settled_at", sql: "timestamptz" },
    { name: "notes", sql: "text" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  coupon_legs: [
    { name: "coupon_id", sql: "uuid references public.coupons(id) on delete cascade" },
    { name: "prediction_id", sql: "uuid references public.predictions(id) on delete set null" },
    { name: "match_id", sql: "uuid references public.matches(id) on delete cascade" },
    { name: "prediction_type", sql: "text" },
    { name: "pick", sql: "text" },
    { name: "probability", sql: "numeric" },
    { name: "odds", sql: "numeric" },
    { name: "result_status", sql: "text default 'pending'" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  match_results: [
    { name: "match_id", sql: "uuid references public.matches(id) on delete cascade" },
    { name: "home_goals", sql: "integer" },
    { name: "away_goals", sql: "integer" },
    { name: "outcome_1x2", sql: "text" },
    { name: "source", sql: "text" },
    { name: "settled_at", sql: "timestamptz default now()" },
    { name: "notes", sql: "text" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  odds_snapshots: [
    { name: "match_id", sql: "uuid references public.matches(id) on delete cascade" },
    { name: "bookmaker", sql: "text" },
    { name: "captured_at", sql: "timestamptz default now()" },
    { name: "odds_1", sql: "numeric" },
    { name: "odds_x", sql: "numeric" },
    { name: "odds_2", sql: "numeric" },
    { name: "odds_1x", sql: "numeric" },
    { name: "odds_x2", sql: "numeric" },
    { name: "odds_12", sql: "numeric" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
  bankroll_transactions: [
    { name: "occurred_at", sql: "timestamptz default now()" },
    { name: "type", sql: "text" },
    { name: "amount", sql: "numeric" },
    { name: "coupon_id", sql: "uuid references public.coupons(id) on delete set null" },
    { name: "note", sql: "text" },
    { name: "created_at", sql: "timestamptz default now()" },
  ],
};

export function expectedColumns(table: TableName, owner: string): string[] {
  return ["id", owner, ...SCHEMA[table].map((c) => c.name)];
}

/**
 * Non-destructive SQL: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
 * Never drops, renames, retypes or truncates anything. Policies are only added
 * to tables that have NO policies yet, so existing owner policies stay untouched.
 */
export function buildMigrationSql(
  owner: string,
  only?: { missingTables: TableName[]; missingColumns: Partial<Record<TableName, string[]>> },
): string {
  const order: TableName[] = [
    "scan_runs",
    "matches",
    "predictions",
    "coupons",
    "coupon_legs",
    "match_results",
    "odds_snapshots",
    "bankroll_transactions",
  ];
  const lines: string[] = [
    "-- MONEYBALL GLOBAL 2.0 — migracja NIEDESTRUKCYJNA",
    "-- Nie usuwa, nie zmienia typów i nie nadpisuje istniejących tabel ani danych.",
    "-- Uruchom w Supabase → SQL Editor dopiero po przejrzeniu.",
    "",
  ];
  for (const t of order) {
    const isMissingTable = !only || only.missingTables.includes(t);
    const cols = only
      ? isMissingTable
        ? SCHEMA[t]
        : SCHEMA[t].filter((c) => only.missingColumns[t]?.includes(c.name))
      : SCHEMA[t];
    const ownerMissing = only ? only.missingColumns[t]?.includes(owner) : false;
    if (!isMissingTable && cols.length === 0 && !ownerMissing) continue;
    lines.push(`-- ${t}`);
    if (isMissingTable) {
      lines.push(
        `create table if not exists public.${t} (`,
        `  id uuid primary key default gen_random_uuid(),`,
        `  ${owner} uuid not null default auth.uid() references auth.users(id) on delete cascade`,
        `);`,
      );
    }
    if (ownerMissing) {
      lines.push(
        `alter table public.${t} add column if not exists ${owner} uuid default auth.uid() references auth.users(id) on delete cascade;`,
      );
    }
    for (const c of cols) {
      lines.push(`alter table public.${t} add column if not exists ${c.name} ${c.sql};`);
    }
    if (isMissingTable) {
      lines.push(
        `grant select, insert, update, delete on public.${t} to authenticated;`,
        `grant all on public.${t} to service_role;`,
        `alter table public.${t} enable row level security;`,
        `do $$ begin`,
        `  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = '${t}') then`,
        `    create policy "${t}_owner_all" on public.${t} for all to authenticated`,
        `      using (auth.uid() = ${owner}) with check (auth.uid() = ${owner});`,
        `  end if;`,
        `end $$;`,
        `create index if not exists ${t}_${owner}_idx on public.${t}(${owner});`,
      );
    }
    lines.push("");
  }
  lines.push("notify pgrst, 'reload schema';");
  return lines.join("\n");
}
