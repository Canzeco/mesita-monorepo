"use client";

// Mesita staff open any place (MESITA-3103). The search is the Claim
// search; opening a place asks business-web-get-place, which lets a
// super-admin through and nobody else.

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { findPlaces, type FoundPlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";

export function StaffFind() {
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
      <div>
        <p className="font-semibold">Open any place</p>
        <p className="text-muted-foreground text-sm">Mesita staff only.</p>
      </div>
      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Place name" className={`${INPUT_BASE} h-10 px-3`} aria-label="Place name" />
        <button type="submit" disabled={busy} className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60">
          <Search className="size-4" aria-hidden /> Find
        </button>
      </form>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {rows ? (
        rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Mesita place by that name.</p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/places/${encodeURIComponent(p.id)}/profile`} className="hover:bg-muted/50 flex flex-col px-1 py-3">
                  <span className="font-medium">{p.name ?? "Unnamed place"}</span>
                  <span className="text-muted-foreground text-sm">{p.address ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}
