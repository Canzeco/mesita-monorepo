import type { Perk } from "@/components/consumer/me/perk-list";
import type { GuestClass } from "@/lib/guest-standing";

// The Class card's words, row by row. ClassList draws them (the sheet and
// /me/class), and so does /me/class' loading.tsx, which draws them as
// themselves so its lines wrap where the page's do (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). The words exist once, here.
//
// A PLAIN MODULE, NOT ClassSheet's: the fallback is a server component, and
// a value it imports from a "use client" file arrives as a client reference,
// not the words.
//
// CLASS IS NOT PLAN (see ClassSheet): nothing here names a plan, a price or
// a buy; the one VIP perk is tagged Soon.
//
// CLASS IS SOON (Pato, MESITA-3027): everyone is Regular for now. VIP wears
// a Soon tag on its title, and CLASS_SOON_NOTE says classes change later.

export type ClassRowWords = {
  title: string;
  /** The row's fixed line; the guest's own row adds a Current pill. */
  subtitle: string;
  /** A class nobody can be in yet: a Soon tag beside the title. */
  soon?: boolean;
  perks?: { label: string; items: Perk[] };
};

export const CLASS_ROWS: Record<GuestClass, ClassRowWords> = {
  regular: {
    title: "Regular",
    subtitle: "Every member.",
  },
  vip: {
    title: "VIP",
    soon: true,
    subtitle:
      "Through Mesita's partners, like agencies and creator partnerships. Never bought.",
    perks: {
      label: "Comes with VIP",
      items: [{ text: "Special rates at partner venues", soon: true }],
    },
  },
};

/** Under the card for a Regular guest (MESITA-3027). */
export const CLASS_SOON_NOTE =
  "Everyone is Regular for now. Classes will change later on.";
