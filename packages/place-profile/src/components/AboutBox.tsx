import { Box } from "./place-detail/box";
import { PLACE_BODY_CLASS } from "../lib/ui";
import { cn } from "../lib/format";

// The place's Presentation card. English only (Mesita core). Spanish TMS is
// later (MESITA-939) — do not show a second language here.
//
// THE HEADING IS "PRESENTATION" (Pato, 2026-09-05) and it carries no place
// name. It used to read "About <name>", and the name was doing real work: on a
// page of stacked sections, a bare "ABOUT" would have been read as "about the
// section directly above it". "Presentation" does not have that ambiguity — it
// names the thing itself rather than pointing at a subject — so the name
// became redundant and the `name` prop went with it.
//
// THE RENAME STOPS AT THE LABEL. The component, its file and its prop stay
// AboutBox/`text`, matching how every other label change in this repo is
// scoped (root CLAUDE.md: a rename never travels into routes, code or
// columns). `places.description` is untouched.
//
// The field is capped at 500 characters (MESITA-2248). The full text always
// renders (MESITA-2262). There is no line-clamp and no Show more / Show less
// control: a story that cannot exceed 500 characters has nothing worth hiding.
//
// Enricher Abouts are multi-paragraph (blank-line separated). Normalize
// to \n\n and render with whitespace-pre-wrap so paragraphs show.

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
  // NO TEXT, NO BOX (Pato, MESITA-2700: "Hide a box entirely when it has
  // nothing, instead of drawing …"). MESITA-2685 drew a muted "…" here.
  if (!body) return null;

  return (
    // The place scale (MESITA-2636): the shared card and title, prose at
    // 14px ink (it was 16px grey, the one paragraph on the screen at that
    // size).
    <Box title={HEADING}>
      <p className={cn(PLACE_BODY_CLASS, "whitespace-pre-wrap")}>{body}</p>
    </Box>
  );
}
