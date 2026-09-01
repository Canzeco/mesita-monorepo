// What a stored class key means, for the one console surface that has to
// write one by hand.
//
// `consumers.class_key` and `consumers.invitation_class_key` both FK to
// `public.classes`, which holds the four metals. Plan is a separate column.
const STORED_CLASS_LABEL: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  // Leftover keys, if a row is read mid-cutover.
  standard: "Bronze",
  influencer: "Silver",
  premium: "Bronze · Premium",
  aura: "Diamond",
};

/** An unrecognised key prints as itself — never silently as the floor. */
export function storedClassLabel(key: string | null): string {
  if (!key) return "—";
  return STORED_CLASS_LABEL[key] ?? key;
}

// Which classes an invitation may grant. Bronze is the floor (no invitation
// needed). Premium is a PLAN, never granted as a class. Gold has no live
// door yet — an invitation may still name it; the EF is generic over any
// classes row.
export const INVITATION_CLASSES: { key: string; label: string; blurb: string }[] =
  [
    {
      key: "diamond",
      label: "Diamond",
      blurb: "Top of the ladder — what a hand-picked invitation normally means.",
    },
    {
      key: "silver",
      label: "Silver",
      blurb: "The entry reach band, granted without waiting for the follower count.",
    },
  ];

/** How a settled `class_origin` reads to an operator. */
export const ORIGIN_LABEL: Record<string, string> = {
  invitation: "Direct invitation",
  instagram: "Instagram reach",
  default: "Nothing above the floor",
};
