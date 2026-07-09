"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Search, X } from "lucide-react";
import { unitSectionHref } from "./nav";
import { UnitThumb } from "./UnitEditChrome";
import { useUnitCatalogSearch } from "./useUnitCatalogSearch";
import { ErrorNote } from "./ui";

export function UnitSelectCatalog() {
  const router = useRouter();
  const { q, setQ, hits, pending, error, metaLabel, searchedQuery, clear } =
    useUnitCatalogSearch();

  const pick = (projectId: string) => {
    router.push(unitSectionHref(projectId, "place"));
  };

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12 lg:-mx-8">
      <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-b px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-8">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Edit Single Unit
        </p>
        <div className="border-border bg-background focus-within:border-foreground focus-within:ring-foreground/10 mt-3 flex h-14 items-center gap-3 rounded-xl border px-4 shadow-sm transition focus-within:ring-2 sm:h-16 sm:gap-4 sm:px-5">
          <Search className="text-muted-foreground h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or unit id…"
            autoFocus
            aria-label="Search units"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none sm:text-lg"
          />
          {pending && q.trim().length >= 2 && (
            <Loader2 className="text-muted-foreground h-5 w-5 shrink-0 animate-spin" />
          )}
          {!pending && q.length > 0 && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 sm:px-6 lg:px-8">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Edit Single Unit · {metaLabel}
        </p>

        {error && <ErrorNote message={error} />}

        <div className="mt-4 flex flex-col gap-2">
          {hits.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u.id)}
              className="border-border bg-card hover:border-foreground/40 flex items-center gap-3 rounded-xl border p-3 text-left transition"
            >
              <UnitThumb photo={u.photo} name={u.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {u.category_label ?? u.category ?? "—"}
                  {u.status ? ` · ${u.status}` : ""}
                  {u.address ? ` · ${u.address}` : ""}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            </button>
          ))}
          {!pending && hits.length === 0 && !error && searchedQuery !== null && (
            <div className="border-border bg-card rounded-2xl border px-4 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {`No units match “${searchedQuery}”.`}
              </p>
            </div>
          )}
          {!pending && hits.length === 0 && !error && searchedQuery === null && q.trim().length === 0 && (
            <div className="border-border bg-card rounded-2xl border px-4 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No units in the catalog yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
