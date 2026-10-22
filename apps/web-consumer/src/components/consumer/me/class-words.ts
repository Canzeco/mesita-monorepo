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

export type ClassRowWords = {
  title: string;
  /** The row's fixed line, under "Your class." when it is the guest's. */
  subtitle: string;
  perks?: { label: string; items: Perk[] };
};

export const CLASS_ROWS: Record<GuestClass, ClassRowWords> = {
  regular: {
    title: "Regular",
    subtitle: "Every member.",
  },
  vip: {
    title: "VIP",
    subtitle:
      "Through Mesita's partners, like agencies and creator partnerships. Never bought.",
    perks: {
      label: "Comes with VIP",
      items: [{ text: "Special rates at partner venues", soon: true }],
    },
  },
};
