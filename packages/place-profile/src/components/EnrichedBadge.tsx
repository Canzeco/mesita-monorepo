import { cn } from "../lib/format";

// The Enriched mark (MESITA-2296): it sits right after a place's name when an
// Enrich run has completed, so a guest can tell the finished profiles from
// the many that are only Created. Display only; it is never a button.
//
// It IS the classic Twitter verified badge, rosette and white check, in red
// instead of blue (Pato, MESITA-2865: "use the iconic twitter verified icon
// but red instead of blue"). It replaced a pink seal with a sparkle.
//
// AFTER THE NAME, 20px (Pato, MESITA-2628: "put selected at the right
// better, but make it bigger"). The size is this default, so every caller
// grows with it.

export function EnrichedBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Enriched"
      className={cn("inline-block h-5 w-5 shrink-0", className)}
    >
      <title>Enriched</title>
      <path
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34Z"
        fill="#F4212E"
      />
      <path
        d="M10.54 16.2 6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77Z"
        fill="#fff"
      />
    </svg>
  );
}
