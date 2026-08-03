"use client";

import { Brain, Cpu, Globe, Wrench } from "lucide-react";
import { Collapsible } from "../enricher-config/atlas-ui";
import type { TraceSource, TraceStep } from "./types";

// MemoTrace — the "how Memo thought" inspector under each Memo reply. Renders
// the reasoning trace admin-web-ask-memo returns: the RAG-first Lineup recall,
// each OpenAI reasoning round (the model's thought + which tools it chose), and
// every tool dispatch (Lineup / Perplexity / Mesita catalog) with args, a
// public-safe result summary, and timings. Read-only, calm admin styling.

const SOURCE_CLS: Record<TraceSource, string> = {
  "OpenAI": "bg-violet-100 text-violet-700",
  "Lineup engine": "bg-emerald-100 text-emerald-700",
  "Perplexity (web)": "bg-sky-100 text-sky-700",
  "Mesita catalog": "bg-amber-100 text-amber-700",
};

function SourceChip({ source }: { source: TraceSource }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${SOURCE_CLS[source]}`}
    >
      {source}
    </span>
  );
}

function StepIcon({ step }: { step: TraceStep }) {
  if (step.kind === "recall") {
    return <Brain className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  }
  if (step.kind === "model") {
    return <Cpu className="h-3.5 w-3.5 shrink-0 text-violet-600" />;
  }
  if (step.tool === "web_search") {
    return <Globe className="h-3.5 w-3.5 shrink-0 text-sky-600" />;
  }
  return <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-600" />;
}

function fmtMs(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ArgChips({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args ?? {});
  if (entries.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <code
          key={k}
          className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]"
        >
          {k}: {typeof v === "string" ? v : JSON.stringify(v)}
        </code>
      ))}
    </div>
  );
}

export function MemoTrace({ trace }: { trace: TraceStep[] }) {
  if (!trace || trace.length === 0) return null;
  const total = trace.reduce((s, t) => s + (t.ms || 0), 0);
  const tools = trace.filter((t) => t.kind === "tool").length;

  return (
    <Collapsible
      summary={`How Memo thought · ${trace.length} steps · ${plural(
        tools,
        "tool call",
      )} · ${fmtMs(total)}`}
    >
      <ol className="border-border/70 space-y-2 border-l pl-4">
        {trace.map((step, i) => (
          <li key={i} className="relative">
            <span className="border-border bg-muted absolute top-3 -left-[21px] h-2 w-2 rounded-full border" />
            <div className="border-border bg-card rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <StepIcon step={step} />
                <span className="text-[12.5px] font-semibold">{step.title}</span>
                <SourceChip source={step.source} />
                <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px] tabular-nums">
                  {fmtMs(step.ms)}
                </span>
              </div>

              {step.kind === "recall" && (
                <div className="mt-1.5 text-[12px]">
                  <p className="text-muted-foreground">
                    Recalled{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {step.poolSize}
                    </span>{" "}
                    candidates near the user
                    {step.embedded
                      ? ", embedded the intent + cosine-ranked the pool"
                      : " (geo pool, no embedding)"}
                    .
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Intent: <span className="text-foreground">{step.intent || "—"}</span>
                  </p>
                  {step.cards.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {step.cards.map((c, j) => (
                        <li
                          key={j}
                          className="text-foreground/80 flex items-center gap-1.5 text-[11.5px]"
                        >
                          <span className="truncate">{c.name}</span>
                          {typeof c.rating === "number" && (
                            <span className="text-muted-foreground shrink-0 tabular-nums">
                              {c.rating.toFixed(1)}★
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {step.kind === "model" && (
                <div className="mt-1.5 text-[12px]">
                  <p className="text-muted-foreground">
                    <span className="font-mono">{step.model}</span>
                    {step.toolsOffered ? " · tools available" : " · no tools (final)"}
                  </p>
                  {step.thought && (
                    <p className="text-foreground/90 mt-1 whitespace-pre-wrap italic">
                      “{step.thought}”
                    </p>
                  )}
                  {step.toolCalls.length > 0 ? (
                    <div className="mt-1.5 space-y-1">
                      {step.toolCalls.map((tc, j) => (
                        <div
                          key={j}
                          className="border-border/70 rounded border border-dashed p-1.5"
                        >
                          <span className="text-[11.5px] font-medium">
                            → calls{" "}
                            <code className="bg-muted rounded px-1 py-0.5">{tc.name}</code>
                          </span>
                          <ArgChips args={tc.args} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    !step.thought && (
                      <p className="text-muted-foreground mt-1 text-[11.5px]">
                        Answered directly — no tools this round.
                      </p>
                    )
                  )}
                </div>
              )}

              {step.kind === "tool" && (
                <div className="mt-1.5 text-[12px]">
                  <ArgChips args={step.args} />
                  <p className="text-foreground/80 mt-1.5 whitespace-pre-wrap">
                    {step.summary || "—"}
                  </p>
                  {(step.predictions > 0 || step.citations > 0) && (
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {step.predictions > 0 && plural(step.predictions, "card")}
                      {step.predictions > 0 && step.citations > 0 && " · "}
                      {step.citations > 0 && plural(step.citations, "citation")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Collapsible>
  );
}
