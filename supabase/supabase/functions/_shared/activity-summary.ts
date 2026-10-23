// Activity summary helpers (MESITA-2745).

export type GuestSocialSummary = {
  viewedMembers: number;
  savedMembers: number;
  viewedEvents: number;
  savedEvents: number;
};

export type PlaceActivityWindowRow = {
  consumer_id: string;
  kind: string;
};

/** Distinct members and row counts for viewed/saved in a window. */
export function summarizeGuestSocial(
  rows: readonly PlaceActivityWindowRow[],
): GuestSocialSummary {
  const viewedMembers = new Set<string>();
  const savedMembers = new Set<string>();
  let viewedEvents = 0;
  let savedEvents = 0;
  for (const row of rows) {
    if (row.kind === "viewed") {
      viewedEvents += 1;
      viewedMembers.add(row.consumer_id);
    } else if (row.kind === "saved") {
      savedEvents += 1;
      savedMembers.add(row.consumer_id);
    }
  }
  return {
    viewedMembers: viewedMembers.size,
    savedMembers: savedMembers.size,
    viewedEvents,
    savedEvents,
  };
}
