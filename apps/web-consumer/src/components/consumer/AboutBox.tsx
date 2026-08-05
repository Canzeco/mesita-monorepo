"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Expandable About card. Shows English (core) + Spanish (translation) in the
// same box (MESITA-926). Short copy renders in full; long copy clamps with
// Show more. Enricher Abouts are multi-paragraph (blank-line separated).

const LONG_TEXT_THRESHOLD = 600;

function formatAboutDisplay(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const blankSplit = normalized
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .replace(/\n+/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (blankSplit.length > 1) return blankSplit.join("\n\n");
  const soft = normalized
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  return soft.length > 1 ? soft.join("\n\n") : normalized;
}

type AboutBoxProps = {
  /** Canonical English About (Mesita core). */
  text: string;
  /** Spanish translation — shown below English when present. */
  textEs?: string | null;
  name: string;
};

export function AboutBox({ text, textEs, name }: AboutBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const en = (text ?? "").trim();
  const es = (textEs ?? "").trim();
  if (!en && !es) return null;

  const showBoth = Boolean(en && es);
  // Legacy: only one language filled — render unlabeled (pre-MESITA-926 rows).
  const combinedLen = en.length + es.length;
  const isLong = combinedLen > LONG_TEXT_THRESHOLD;
  const heading = `About ${name}`;
  const enBody = en ? formatAboutDisplay(en) : "";
  const esBody = es ? formatAboutDisplay(es) : "";

  const body = (
    <>
      {en ? (
        <div className="flex flex-col gap-1.5">
          {showBoth ? (
            <span className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
              English
            </span>
          ) : null}
          <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
            {enBody}
          </p>
        </div>
      ) : null}
      {es ? (
        <div className={cn("flex flex-col gap-1.5", en && "border-border border-t pt-3")}>
          {showBoth || !en ? (
            <span className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
              Español
            </span>
          ) : null}
          <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
            {esBody}
          </p>
        </div>
      ) : null}
    </>
  );

  if (!isLong) {
    return (
      <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          {heading}
        </h3>
        {body}
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="border-border bg-card hover:bg-card/80 flex flex-col gap-3 rounded-2xl border p-4 text-left transition"
    >
      <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
        {heading}
      </h3>
      <div
        className={cn(
          "flex flex-col gap-3",
          !expanded && "max-h-[16.5rem] overflow-hidden",
        )}
      >
        {body}
      </div>
      <span className="text-foreground inline-flex items-center gap-1 text-[11px] font-semibold">
        {expanded ? "Show less" : "Show more"}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </span>
    </button>
  );
}
