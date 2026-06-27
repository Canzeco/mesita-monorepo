"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Search,
  AlertTriangle,
} from "lucide-react";
import { findPlaceByPlaceId, type FindPlaceResult } from "./actions";
import { formatShortDate } from "@/lib/format";

export function BusinessLinkForm() {
  const [placeId, setPlaceId] = useState("");
  const [result, setResult] = useState<FindPlaceResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      const r = await findPlaceByPlaceId(placeId);
      setResult(r);
    });
  };

  const copyLink = async () => {
    if (!result || !result.ok || !("link" in result)) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-8 space-y-5">
      <form onSubmit={onSubmit}>
        <div className="border-border bg-card shadow-elev rounded-3xl border p-1">
          <div className="border-border bg-background rounded-[20px] border">
            <input
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              spellCheck={false}
              autoFocus
              aria-label="Google Place ID"
              className="placeholder:text-muted-foreground/50 block w-full bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
            />
            <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-muted-foreground text-xs">
                We resolve this against the places table and hand you a
                clean link. Sign into business.mesita.ai with your operator
                account to edit.
              </p>
              <button
                type="submit"
                disabled={pending || placeId.trim().length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {pending ? "Looking up…" : "Find place"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {result && !result.ok && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{result.error}</p>
        </div>
      )}

      {result && result.ok && !result.found && (
        <div className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
          <p className="text-foreground font-medium">
            Not in Mesita yet
          </p>
          <p className="mt-1">
            No place has{" "}
            <code className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-xs">
              {result.placeId}
            </code>{" "}
            as its Google Place ID. Create it from the business console first
            (or via the bulk create flow), then come back here to edit.
          </p>
        </div>
      )}

      {result && result.ok && result.found && (
        <section className="border-border bg-pink-gradient shadow-elev relative overflow-hidden rounded-3xl border p-6">
          <p className="text-secondary text-xs font-medium tracking-[0.14em] uppercase">
            Place found
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {result.place.name}
          </p>
          <p className="text-foreground/70 mt-1 text-sm">
            <span className="font-mono">{result.place.slug}</span>
            {" · "}
            <span className="font-medium">{result.place.status}</span>
            {" · added "}
            {formatShortDate(result.place.created_at)}
            {" · updated "}
            {formatShortDate(result.place.updated_at)}
          </p>

          <div className="bg-background mt-5 rounded-2xl p-4">
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
              Business link
            </p>
            <code className="text-foreground/80 mt-2 block max-w-full overflow-x-auto rounded-lg px-2 py-2 font-mono text-xs leading-relaxed">
              {result.link}
            </code>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="bg-foreground text-background hover:opacity-90 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-background hover:bg-muted/40 border-border inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition"
              >
                <ExternalLink className="h-4 w-4" />
                Open in business console
              </a>
            </div>
            <p className="text-muted-foreground/80 mt-3 text-[11px] leading-relaxed">
              Plain URL — no token. Open it signed into your business
              account; the EFs check your email against super_admins and
              grant place access. The Topbar will show a Super-admin
              banner so you know elevation is active.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
