// Account had no loading boundary either, for the same reason and with the
// same effect: no boundary means the router holds the old screen and the click
// looks ignored (MESITA-1729). See organization/loading.tsx for the mechanism.
//
// IT MUST DRAW THE PAGE THAT ACTUALLY LOADS (MESITA-1833). This has been wrong
// three times — a heading bar plus a 132px card, then an identity header over
// two 64px rows, then three separate boxes — each time the shape of a page
// that no longer existed, so every load ended in a layout shift on swap. A
// skeleton is a promise about what is coming.
//
// ONE card now (MESITA-1840), full width (MESITA-1836): three 96px rows
// divided by the same hairline, nothing inside them. The height and the
// dividers mirror SCOPE_CARD_CLASS + SCOPE_ROW_CLASS exactly — if those
// change, this changes with them.
export default function Loading() {
  return (
    <>
      <span className="sr-only">Loading account…</span>
      <div
        aria-hidden="true"
        className="border-border divide-border w-full divide-y overflow-hidden rounded-2xl border"
      >
        <div className="bg-muted h-24 animate-pulse" />
        <div className="bg-muted h-24 animate-pulse" />
        <div className="bg-muted h-24 animate-pulse" />
      </div>
    </>
  );
}
