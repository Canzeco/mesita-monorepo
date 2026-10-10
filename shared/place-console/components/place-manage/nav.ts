// The admin-section-id → business-route mapper that ProfileCompleteness and
// OrdersCard need. Business owns its OWN routes: sharing admin's nav module
// would tie two consoles' addressing together.
//
// Only this function survives here (MESITA-1558): the tab LIST that used to
// sit above it had zero consumers and duplicated `lib/place-tabs.ts`, which is
// the one vocabulary the chrome reads.
//
// TWO MAPPINGS MOVED IN MESITA-1841, AND ONE MOVED BACK IN MESITA-1892.
//
//   promos → capabilities, not "settings". The name reverted (the view was
//   Capabilities until MESITA-1815 and is again), and the only chip that uses
//   this id is "Pick a reservation channel" — a CAPABILITY, not a reward. Had
//   it pointed at Rewards it would have opened a page without the control it
//   was sent to find. `capabilities` is a retired SEGMENT since MESITA-1885
//   and forwards to Visits, so the chip still lands — one hop, on the
//   container that holds the control it names.
//
//   performance → `/places/<id>/activity`, the place's own page again.
//   MESITA-1841 moved Activity up to the organization and this returned the
//   FLAT `/activity` because there was no place-scoped address left to name;
//   MESITA-1892 deleted the organization and Activity came back to the
//   address it started from, so the special case is gone and Activity joins
//   the segment below like every other section.
export function placeSectionHref(placeId: string, section: string): string {
  const tab = section === "promos"
    ? "capabilities"
    : section === "performance"
    ? "activity"
    : section === "place"
    ? "profile"
    : section;
  const base = `/places/${encodeURIComponent(placeId)}`;
  // Profile has its own address since MESITA-1732; no tab is the bare base.
  return `${base}/${tab}`;
}
