/**
 * The brand-red dot on a top-row disc's corner: location held, or a filter
 * applied (Pato, 2026-10-17, MESITA-2304). Decorative — the disc's
 * accessible name carries the fact. `data-active` is the test's handle.
 */
export function ActiveDot() {
  return (
    <span
      aria-hidden
      data-active="true"
      className="bg-primary ring-card absolute top-1 right-1 h-2.5 w-2.5 rounded-full ring-2"
    />
  );
}
