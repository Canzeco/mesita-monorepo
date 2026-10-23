import { useState } from "react";
import { Box } from "./place-detail/box";
import { PLACE_BODY_CLASS } from "../lib/ui";
import { cn } from "../lib/format";

// The place's Presentation card. English only (Mesita core). Spanish TMS is
// later (MESITA-939) — do not show a second language here.
//
// Storage allows up to 2000 characters (MESITA-2739). Guests see the first
// 500 with Read more; admin shows the full text.

export const ABOUT_CONSUMER_PREVIEW_MAX = 500;

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

const HEADING = "Presentation";

export function AboutBox({
  text,
  previewMax = ABOUT_CONSUMER_PREVIEW_MAX,
}: {
  text: string;
  /** Omit or set very high in admin to show full presentation. */
  previewMax?: number;
}) {
  const body = formatAboutDisplay(text);
  const [expanded, setExpanded] = useState(false);
  if (!body) return null;

  const needsMore = previewMax > 0 && body.length > previewMax;
  const visible = needsMore && !expanded ? body.slice(0, previewMax).trimEnd() + "…" : body;

  return (
    <Box title={HEADING}>
      <p className={cn(PLACE_BODY_CLASS, "whitespace-pre-wrap")}>{visible}</p>
      {needsMore ? (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </Box>
  );
}
