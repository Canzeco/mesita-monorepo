import type { PlaceDetail } from "../place-detail";
import { Section } from "./place-detail/section";
import { TagChips } from "./place-detail/place-link-chips";

// About — the first section of the place scroll (MESITA-2441): the place's
// story, then its Mesita tags. English only (Mesita core); Spanish TMS is
// later (MESITA-939).
//
// decision: Pato (2026-10-19) — the heading is "About" again. It read
// "Presentation" (2026-09-05) because a bare ABOUT among stacked boxes
// looked like it was about the box above; on one titled scroll it is not.
// The component, file and `places.description` keep their names.
//
// The field is capped at 500 characters (MESITA-2248). The full text always
// renders (MESITA-2262): no line-clamp, no Show more.
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

export function AboutBox({
  text,
  tags = [],
}: {
  text: string;
  tags?: PlaceDetail["tags"];
}) {
  const body = formatAboutDisplay(text);
  if (!body && tags.length === 0) return null;
  return (
    <Section title="About">
      {body && (
        <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
          {body}
        </p>
      )}
      <TagChips tags={tags} />
    </Section>
  );
}
