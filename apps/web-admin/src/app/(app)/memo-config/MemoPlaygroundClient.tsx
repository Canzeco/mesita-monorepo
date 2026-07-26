"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  MapPin,
  MessageSquare,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import { askMemo } from "./actions";
import type { AskMemoResult, MemoPrediction } from "./types";

// Live Memo Playground — asks the real concierge (consumer-web-ask-memo) with
// the currently-saved persona and renders what a guest would get: the answer,
// the places Memo surfaced, its follow-ups, and any citations. Read-only —
// nothing here writes config.

const EXAMPLES = [
  "rooftop date tonight under $$$",
  "tacos al pastor near Roma Norte",
  "quiet café to work from with good wifi",
  "where to take out-of-town friends for mezcal",
];

const STATUS_BADGE: Record<
  MemoPrediction["status"],
  { label: string; cls: string }
> = {
  verified_partner_self: {
    label: "On Mesita",
    cls: "bg-secondary/10 text-secondary",
  },
  verified_partner_other: {
    label: "On Mesita",
    cls: "bg-secondary/10 text-secondary",
  },
  web_listed: { label: "Web", cls: "bg-muted text-muted-foreground" },
  not_in_mesita: { label: "Web", cls: "bg-muted text-muted-foreground" },
};

export function MemoPlaygroundClient() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AskMemoResult | null>(null);
  const [ranQuery, setRanQuery] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canRun = query.trim().length >= 2;
  const stale = ranQuery != null && ranQuery !== query.trim();

  const run = () => {
    if (!canRun) return;
    const q = query.trim();
    startTransition(async () => {
      const r = await askMemo({ query: q });
      setResult(r);
      setRanQuery(q);
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Test query"
        subtitle="Ask Memo exactly what a guest would from the Ask AI tab. This calls the live concierge with the currently-saved persona — save your Config edits first."
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. rooftop date tonight under $$$"
          disabled={pending}
          className="border-border bg-card focus:border-foreground mt-4 w-full rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              disabled={pending}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {stale && (
            <span className="text-[11px] font-medium text-amber-600">
              query changed since the last run
            </span>
          )}
          <button
            type="button"
            onClick={run}
            disabled={pending || !canRun}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {pending ? "Asking Memo…" : "Ask Memo"}
          </button>
        </div>
      </SectionCard>

      {result && !result.ok && <ErrorNote message={result.error} />}

      {result && result.ok ? (
        <SectionCard
          icon={<Sparkles className="text-secondary h-4 w-4" />}
          title="Memo's answer"
        >
          <p className="text-foreground/90 mt-4 text-sm leading-relaxed whitespace-pre-wrap">
            {result.answer || "(Memo returned no answer text.)"}
          </p>

          {result.predictions.length > 0 && (
            <div className="mt-5">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Places surfaced ({result.predictions.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.predictions.map((p) => {
                  const badge = STATUS_BADGE[p.status];
                  return (
                    <li
                      key={p.placeId}
                      className="border-border bg-card flex items-start gap-3 rounded-xl border p-3"
                    >
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{p.mainText}</span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </p>
                        {p.secondaryText && (
                          <p className="text-muted-foreground truncate text-xs">
                            {p.secondaryText}
                          </p>
                        )}
                      </div>
                      {typeof p.rating === "number" && (
                        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs tabular-nums">
                          <Star className="h-3 w-3" />
                          {p.rating.toFixed(1)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.related.length > 0 && (
            <div className="mt-5">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Follow-ups
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.related.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-2.5 py-1 text-xs transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {result.citations.length > 0 && (
            <div className="mt-5">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Citations
              </p>
              <ul className="mt-2 space-y-1">
                {result.citations.map((c) => (
                  <li key={c} className="truncate text-xs">
                    <a
                      href={c}
                      target="_blank"
                      rel="noreferrer"
                      className="text-secondary hover:underline"
                    >
                      {c}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      ) : (
        !result && (
          <SectionCard
            icon={<Sparkles className="text-secondary h-4 w-4" />}
            title="Memo's answer"
          >
            <p className="text-muted-foreground mt-4 text-sm">
              No query yet — ask Memo something above to see its answer, the
              places it surfaces, and its follow-ups.
            </p>
          </SectionCard>
        )
      )}
    </div>
  );
}
