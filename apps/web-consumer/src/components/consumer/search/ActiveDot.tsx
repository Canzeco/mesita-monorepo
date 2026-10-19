/**
 * The dot on the locate disc's corner: the guest's location is held
 * (Pato, 2026-10-17, MESITA-2304). It paints `bg-primary`, which is ink on
 * the consumer app, not brand red. Decorative — the disc's accessible name
 * carries the fact. `data-active` is the test's handle.
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
