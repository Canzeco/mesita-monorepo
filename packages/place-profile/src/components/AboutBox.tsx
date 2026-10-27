import { Box } from "./place-detail/box";
import { PLACE_BODY_CLASS } from "../lib/ui";
import { cn } from "../lib/format";

// The place's Presentation card. English only (Mesita core). Spanish TMS is
// later (MESITA-939) — do not show a second language here.
//
// Storage allows up to 2000 characters (MESITA-2739). Everyone sees the full
// text — no Read more / Show less (MESITA-2851).

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
  if (!body) return null;

  return (
    <Box title={HEADING}>
      <p className={cn(PLACE_BODY_CLASS, "whitespace-pre-wrap")}>{body}</p>
    </Box>
  );
}
