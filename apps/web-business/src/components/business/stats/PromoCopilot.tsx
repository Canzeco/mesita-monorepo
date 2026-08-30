"use client";

// MESITA-892 — advisory next-promo copilot on Performance.
// Calm, dense, one job: suggest; Promos still writes rates.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import { Section } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  suggestNextPromo,
  type PromoCopilotResult,
  type PromoSuggestion,
} from "@/lib/api/promo-copilot";
import { promosPath } from "@/lib/business-route-contract";
import { STRATEGY_BY_ID } from "@/lib/business/strategies";
import { cn, errMsg } from "@/lib/utils";

const FOCUS_LABEL: Record<PromoSuggestion["focus"], string> = {
  rates: "Rates",
  welcome: "Welcome",
  story: "Stories",
  review: "Reviews",
  visibility: "Visibility",
  retention: "Retention",
};

export function PromoCopilot({ projectId }: { projectId: string }) {
  const supabase = useBrowserSupabase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromoCopilotResult | null>(null);
  const [query, setQuery] = useState("");

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await suggestNextPromo(supabase, projectId, query));
    } catch (err) {
      setError(errMsg(err, "Could not get reward suggestions."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Next reward"
      description="Memo reads your Performance record and suggests a move. You still set rates on Partnership."
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void run();
          }}
          placeholder="Optional: ask about Welcome, stories, rates…"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-foreground/40 h-9 flex-1 rounded-lg border px-3 text-xs outline-none"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="bg-foreground text-background inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {result ? "Ask again" : "Suggest next promo"}
        </button>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {result ? (
        <div className="flex flex-col gap-2.5">
          {result.answer ? (
            <p className="text-foreground/85 text-[13px] leading-snug">
              {result.answer}
            </p>
          ) : null}
          {result.suggestions.map((s, i) => (
            <SuggestionRow key={`${s.headline}-${i}`} suggestion={s} />
          ))}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-muted-foreground text-[10.5px]">
              {result.source === "memo"
                ? "Advisory · Memo-backed"
                : "Advisory · offline heuristic"}
            </p>
            <Link
              href={promosPath(projectId)}
              className="text-foreground inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            >
              Open Partnership
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function SuggestionRow({ suggestion }: { suggestion: PromoSuggestion }) {
  const strategy = suggestion.strategyId
    ? STRATEGY_BY_ID[suggestion.strategyId]
    : null;

  return (
    <div className="border-border/60 rounded-xl border px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-foreground text-[13px] font-semibold">
          {suggestion.headline}
        </p>
        <span
          className={cn(
            "text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
          )}
        >
          {FOCUS_LABEL[suggestion.focus]}
        </span>
        {strategy ? (
          <span className="text-muted-foreground text-[10.5px] font-medium">
            {strategy.emoji} {strategy.name}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
        {suggestion.rationale}
      </p>
    </div>
  );
}
