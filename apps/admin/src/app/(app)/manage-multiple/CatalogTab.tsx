"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Search, X } from "lucide-react";
import { unitSectionHref } from "../manage-single/nav";
import { UnitThumb } from "../manage-single/UnitEditChrome";
import { useUnitCatalogSearch } from "../manage-single/useUnitCatalogSearch";

export function CatalogTab() {
  const { q, setQ, hits, pending, error, metaLabel, clear } =
    useUnitCatalogSearch({ variant: "multiple" });

  return (
    <div>
      <div className="border-border focus-within:border-foreground flex items-center gap-3 rounded-xl border px-3 py-2.5">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, slug, or unit id…"
          aria-label="Search Mesita catalog"
          className="placeholder:text-muted-foreground h-9 w-full bg-transparent text-sm outline-none"
        />
        {pending && q.trim().length >= 2 && (
          <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
        )}
        {!pending && q.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
        Mesita catalog · {metaLabel}
      </p>

      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {hits.map((u) => (
          <Link
            key={u.id}
            href={unitSectionHref(u.id, "place")}
            className="border-border bg-card hover:border-foreground/40 flex items-center gap-3 rounded-xl border p-3 transition"
          >
            <UnitThumb photo={u.photo} name={u.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {u.category_label ?? u.category ?? "—"}
                {u.status ? ` · ${u.status}` : ""}
                {u.slug ? ` · ${u.slug}` : ""}
                {u.address ? ` · ${u.address}` : ""}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          </Link>
        ))}
        {!pending && hits.length === 0 && !error && (
          <div className="border-border bg-card rounded-2xl border px-4 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {q.trim().length >= 2
                ? `No units match “${q.trim()}”.`
                : "No units in the catalog yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
