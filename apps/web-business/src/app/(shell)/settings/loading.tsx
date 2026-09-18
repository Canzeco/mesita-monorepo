// Next 16 keeps the PREVIOUS screen painted for a route with no loading
// boundary of its own (MESITA-1729), which reads as a broken menu rather than
// a slow one.
//
// THREE BOXES SINCE MESITA-1974: the PERSON, then the team, then the one
// honest Soon. Settings absorbed Account, so a skeleton drawing only the
// place's two would shift every load by the height of the card at the top.
//
// It was two boxes before that (MESITA-1870): the team, then the Soon. Mesita
// Partner and Mesita Pay left for the catalogue (MESITA-1869) and Brand left
// after them, and a skeleton still promising any of them would shift every
// load by the height of a card that is not coming — exactly the fault this
// file was written to fix (MESITA-1729), in reverse.
//
// AND NO HEADING BAR. The page names no place in its address now, so there is
// no `PlaceHeading` above it and no title skeleton owed here either: the
// person's card carries the `h1`.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading settings…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {/* You, then Access, then Developers at the strip's 72px. */}
        <div className="bg-muted h-24 animate-pulse rounded-2xl" />
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-[72px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
