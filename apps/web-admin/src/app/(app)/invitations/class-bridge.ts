// What a STORED class key means, for the one console surface that has to
// write one by hand.
//
// `consumers.class_key` and `consumers.invitation_class_key` both FK to
// `public.classes`, which still holds the four v1 rows — standard,
// influencer, premium, aura. Classes v2 split that single column into two
// axes (class bronze < silver < gold < diamond, earned; plan free | premium,
// paid), so every stored key resolves onto a PAIR. This is the same four-row
// bridge `web-consumer/src/lib/consumer-data.ts` keeps as
// LEGACY_CLASS_IDENTITY; both delete together when `consumers.plan` lands
// (MESITA-1076).
export const STORED_CLASS_LABEL: Record<string, string> = {
  standard: "Bronze · Free",
  influencer: "Silver · Free",
  premium: "Bronze · Premium",
  aura: "Diamond · Free",
};

/** An unrecognised key prints as itself — never silently as the floor. */
export function storedClassLabel(key: string | null): string {
  if (!key) return "—";
  return STORED_CLASS_LABEL[key] ?? key;
}

// Which classes an invitation may grant.
//
// The set is NOT "every metal on the ladder": it is every `classes` row an
// invitation can sensibly open. `standard` is the floor, which needs no
// invitation, and `premium` is the paid subscription wearing a class costume
// — granting it by hand would fake a Stripe subscription. Gold is absent for
// a harder reason: there is no `gold` row in `classes`, so the FK would
// REJECT the write (MESITA-1076). Same pair, for the same reason, that
// `admin-web-mint-invite-codes` mints PINs for.
//
// The EF is generic over any `classes` row, so a future tier INSERT only has
// to be added here.
export const INVITATION_CLASSES: { key: string; label: string; blurb: string }[] =
  [
    {
      key: "aura",
      label: "Diamond",
      blurb: "Top of the ladder — what a hand-picked invitation normally means.",
    },
    {
      key: "influencer",
      label: "Silver",
      blurb: "The entry reach band, granted without waiting for the follower count.",
    },
  ];

/** How a settled `class_origin` reads to an operator. */
export const ORIGIN_LABEL: Record<string, string> = {
  invitation: "Direct invitation",
  subscription: "Premium subscription",
  instagram: "Instagram reach",
  default: "Nothing above the floor",
};
