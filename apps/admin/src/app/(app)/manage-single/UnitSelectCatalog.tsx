"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ImageOff, Loader2, Search } from "lucide-react";
import { listUnits, searchUnits, type UnitHit } from "./actions";
import { ErrorNote } from "./ui";

export function UnitSelectCatalog() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "search">("browse");

  useEffect(() => {
    start(async () => {
      setError(null);
      const query = q.trim();
      if (query.length === 0) {
        setMode("browse");
        const r = await listUnits();
        if (!r.ok) {
          setError(r.error);
          setHits([]);
          return;
        }
        setHits(r.data);
        return;
      }
      if (query.length < 2) {
        setHits([]);
        setMode("browse");
        return;
      }
      setMode("search");
      const r = await searchUnits(query);
      if (!r.ok) {
        setError(r.error);
        setHits([]);
        return;
      }
      setHits(r.data);
    });
  }, [q]);

  const pick = (unitId: string) => {
    router.push(`/manage-single/${unitId}`);
  };

  const metaLabel =
    mode === "browse"
      ? pending
        ? "Loading catalog…"
        : `Recent units · ${hits.length}`
      : pending
        ? "Searching…"
        : `Results · ${hits.length}`;

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12 lg:-mx-8">
      <div className="border-border bg-card sticky top-0 z-30 border-b px-4 py-3 sm:px-6 lg:px-8">
        <div className="focus-within:border-foreground flex items-center gap-3">
          <Search className="text-muted-foreground h-5 w-5 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, slug, or unit id…"
            autoFocus
            aria-label="Search units"
            className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-base outline-none"
          />
          {pending && (
            <Loader2 className="text-muted-foreground h-5 w-5 shrink-0 animate-spin" />
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
              <UnitThumb photo={u.photo} name={u.name} />
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
            </button>
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
    </div>
  );
}

function UnitThumb({ photo, name }: { photo: string | null; name: string }) {
  if (!photo) {
    return (
      <div className="border-border bg-background text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      className="border-border h-11 w-11 shrink-0 rounded-lg border object-cover"
    />
  );
}
