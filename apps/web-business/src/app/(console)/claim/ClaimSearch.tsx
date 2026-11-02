"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { findPlaces, type FoundPlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";

const MINE_COPY: Record<NonNullable<FoundPlace["mine"]>, string> = {
  owner: "You run this place",
  pending: "Your request is in review",
  expired: "Your verification ended",
};

export function ClaimSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const r = await findPlaces({ q });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else setRows(r.data);
  }

  return (
    <Card className="flex flex-col gap-4">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Your place's name"
          className={`${INPUT_BASE} h-11 px-3`}
          aria-label="Your place's name"
          autoFocus
        />
        <button type="submit" disabled={busy} className="bg-foreground text-background inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
          <Search className="size-4" aria-hidden /> Search
        </button>
      </form>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {rows ? (
        rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Mesita place by that name. Places join Mesita when guests find them; write to support@mesita.ai if yours is missing.</p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/claim/${encodeURIComponent(p.id)}`} className="hover:bg-muted/50 flex items-center gap-4 px-1 py-3">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="bg-muted size-12 shrink-0 rounded-xl" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name ?? "Unnamed place"}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {p.mine ? MINE_COPY[p.mine] : p.address ?? ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}
