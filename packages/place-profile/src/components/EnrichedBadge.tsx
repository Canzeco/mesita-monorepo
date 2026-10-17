import { cn } from "../lib/format";

// The Enriched mark (MESITA-2296): it sits right after a place's name when an
// Enrich run has completed, so a guest can tell the finished profiles from
// the many that are only Created. It borrows the scalloped seal of a verified
// badge but holds a sparkle, not a check, and wears the Mesita pink: Mesita
// did the work on this place, nobody verified anything (verification is
// Second Stage). Display only; it is never a button.

export function EnrichedBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Enriched"
      className={cn("inline-block h-4 w-4 shrink-0", className)}
    >
      <title>Enriched</title>
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        style={{ fill: "var(--brand-pink)" }}
      />
      <path
        d="M12 6.75l1.35 3.9 3.9 1.35-3.9 1.35L12 17.25l-1.35-3.9L6.75 12l3.9-1.35Z"
        fill="#fff"
      />
    </svg>
  );
}
