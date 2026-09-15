// The admin-section-id → business-route mapper that ProfileCompleteness and
// OrdersCard need. Business owns its OWN routes: sharing admin's nav module
// would tie two consoles' addressing together.
//
// Only this function survives here (MESITA-1558): the tab LIST that used to
// sit above it had zero consumers and duplicated `lib/place-tabs.ts`, which is
// the one vocabulary the chrome reads.
//
// TWO MAPPINGS MOVED IN MESITA-1841.
//
//   promos → capabilities, not "settings". The name reverted (the view was
//   Capabilities until MESITA-1815 and is again), and the only chip that uses
//   this id is "Pick a reservation channel" — a CAPABILITY, not a reward. Had
//   it pointed at Rewards it would have opened a page without the control it
//   was sent to find.
//
//   performance → the FLAT `/activity`. Activity is the organization's page
//   now, so there is no `/places/<id>/activity` to name; the flat address
//   resolves the remembered organization. This is the one id whose answer is
//   not under the place, which is why it returns early instead of joining the
//   segment below.
export function placeSectionHref(placeId: string, section: string): string {
  if (section === "performance") return "/activity";
  const tab = section === "promos"
    ? "capabilities"
    : section === "place"
    ? "profile"
    : section;
  const base = `/places/${encodeURIComponent(placeId)}`;
  // Profile has its own address since MESITA-1732; no tab is the bare base.
  return `${base}/${tab}`;
}
