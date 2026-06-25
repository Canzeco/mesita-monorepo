"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, ImageOff, Loader2, Search } from "lucide-react";
import { listUnits, searchUnits, type UnitHit } from "../manage-single/actions";

export function CatalogTab() {
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

  const metaLabel =
    mode === "browse"
      ? pending
        ? "Loading…"
        : `${hits.length} on Mesita`
      : pending
        ? "Searching…"
        : `${hits.length} match${hits.length === 1 ? "" : "es"}`;

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
        {pending && (
          <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
        )}
      </div>

      <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
        Mesita catalog · {metaLabel}
      </p>

      {error && (
        <p className="text-destructive mt-3 text-sm">{error}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {hits.map((u) => (
          <Link
            key={u.id}
            href={`/manage-single/${u.id}/place`}
            className="border-border bg-card hover:border-foreground/40 flex items-center gap-3 rounded-xl border p-3 transition"
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
