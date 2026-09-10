// The Place screen's four tabs (MESITA-1537): Profile · Capabilities ·
// Activity · Admin — the same set admin's Single Place uses, so the ported
// sections keep their call shape. Business owns its OWN `soon` flags: sharing
// admin's nav module would un-park Activity for both consoles at once.

// Only `placeSectionHref` survives here: the admin-section-id → business-route
// mapper that ProfileCompleteness needs. The tab LIST that used to live above
// it had zero consumers and duplicated `lib/place-tabs.ts`, which is the one
// vocabulary the chrome reads (MESITA-1558).
export function placeSectionHref(placeId: string, section: string): string {
  const tab = section === "promos"
    ? "capabilities"
    : section === "place"
    ? "profile"
    : section === "performance"
    ? "activity"
    : section;
  const base = `/places/${encodeURIComponent(placeId)}`;
  // Profile has its own address since MESITA-1732; no tab is the bare base.
  return `${base}/${tab}`;
}
