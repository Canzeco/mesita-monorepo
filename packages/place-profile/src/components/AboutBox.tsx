"use client";

import { useState } from "react";
import { Box } from "./place-detail/box";
import { PLACE_BODY_CLASS } from "../lib/ui";
import { cn } from "../lib/format";

// The place's Presentation card. English only (Mesita core). Spanish TMS is
// later (MESITA-939) — do not show a second language here.
//
// Storage allows up to 2000 characters (MESITA-2739); the Description step
// writes ~1,500 (MESITA-2955). A long text opens folded to its first six
// lines with a Show more under it (Pato, MESITA-2958: "its okey large
// presentaiton but use the show more thing"), reversing MESITA-2851's full
// text. Show more opens it all and goes away — no Show less, like the
// Reviews list's Show more. A text short enough to fit shows whole.

/** Past this many characters the text opens folded. Six lines of the
 *  phone column hold ~270; the desktop card ~360. */
const FOLD_OVER = 400;

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

export function AboutBox({ text }: { text: string }) {
  const body = formatAboutDisplay(text);
  const [expanded, setExpanded] = useState(false);
  if (!body) return null;

  const folded = body.length > FOLD_OVER && !expanded;
  return (
    <Box title={HEADING}>
      <p
        className={cn(
          PLACE_BODY_CLASS,
          "whitespace-pre-wrap",
          folded && "line-clamp-6",
        )}
      >
        {body}
      </p>
      {folded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-foreground mt-1 min-h-11 text-sm font-semibold hover:underline"
        >
          Show more
        </button>
      )}
    </Box>
  );
}
