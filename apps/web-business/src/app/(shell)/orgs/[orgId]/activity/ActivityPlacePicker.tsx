"use client";

// WHICH PLACE these numbers are about — and only when there is a choice.
//
// Activity is the ORGANIZATION's page as of MESITA-1841, and the numbers
// underneath it are one place's: `business-web-get-performance` is
// place-scoped, and adding a place dimension to it is an Edge Function change,
// not a nav change. So the page is honest about what it is showing — the
// organization's activity, one place at a time — and this is the control that
// says which.
//
// AT ONE PLACE IT RENDERS NOTHING. The console is optimized for the owner who
// has exactly one (MESITA-1832), and for them this page is the same screen
// Activity always was, with no control added. MESITA-1818's rule, kept: a
// switcher with nothing to switch is not a switcher.
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronsUpDown, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RailPlace } from "@/lib/api/organizations";
import { cn } from "@/lib/utils";

export function ActivityPlacePicker({
  places,
  selectedId,
}: {
  places: readonly RailPlace[];
  selectedId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  if (places.length < 2) return null;

  const pick = (id: string) => {
    if (id === selectedId) return;
    const next = new URLSearchParams(params.toString());
    next.set("place", id);
    start(() => router.push(`?${next.toString()}`));
  };
  const current = places.find((p) => p.id === selectedId);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label="Which place"
        aria-busy={pending || undefined}
        className={cn(
          "border-border bg-background hover:bg-muted/50 data-[state=open]:bg-muted/50",
          "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Store aria-hidden className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="truncate">{current?.name ?? "Pick a place"}</span>
        <ChevronsUpDown aria-hidden className="text-muted-foreground h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-64 motion-reduce:animate-none">
        <DropdownMenuRadioGroup value={selectedId} onValueChange={pick}>
          {places.map((p) => (
            <DropdownMenuRadioItem
              key={p.id}
              value={p.id}
              className="gap-2.5 rounded-lg py-1.5 text-[13px]"
            >
              <span className="truncate">{p.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
