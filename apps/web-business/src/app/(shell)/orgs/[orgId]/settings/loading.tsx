// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// TWO BOXES, because the page is two boxes (MESITA-1870): Members, then the
// one honest Soon. Mesita Partner and Mesita Pay left for the catalogue
// (MESITA-1869) and Brand left after them, and a skeleton still promising any
// of them would shift every load by the height of a card that is not coming —
// exactly the fault this file was written to fix (MESITA-1729), in reverse.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading settings…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* The h1 and its caption, one group with a `gap-1` between. */}
        <div className="flex flex-col gap-1">
          <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        {/* Members, then Developers at the strip's 72px. */}
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
