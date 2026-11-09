import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchLabel } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";
import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MatchPicker({
  matches,
  value,
  onChange,
  id,
}: {
  matches: Match[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => [...matches].sort((a, b) => (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? "")),
    [matches],
  );
  const current = matches.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{current ? matchLabel(current) : "Wybierz mecz…"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Szukaj drużyny lub ligi…" />
          <CommandList>
            <CommandEmpty>Brak meczów.</CommandEmpty>
            <CommandGroup>
              {sorted.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${matchLabel(m)} ${m.league ?? ""} ${m.id}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === m.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <div className="truncate">{matchLabel(m)}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.league ?? "—"} · {fmtDateTime(m.kickoff_at)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
