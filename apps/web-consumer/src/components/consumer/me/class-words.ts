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
// a buy. CLASS IS SOON (Pato, MESITA-3099): both rows are tagged Soon and
// nothing here joins or leaves one.

export type ClassRowWords = {
  title: string;
  subtitle: string;
  /** A class nobody can be in yet: a Soon tag beside the title. */
  soon?: boolean;
};

/** The one line over the card: what a class is for, in plain words (Pato,
 *  MESITA-3100: "clearer explanation"). */
export const CLASS_LEAD =
  "Coming soon. There are two classes, and VIP members get the VIP voucher where a place offers it.";

export const CLASS_ROWS = {
  regular: {
    title: "Regular Class",
    subtitle: "Everyone on Mesita. You get the standard vouchers.",
    soon: true,
  },
  vip: {
    title: "VIP Class",
    subtitle:
      "Invite only, through our partners like modeling agencies and creators. The VIP voucher too. You can't buy it.",
    soon: true,
  },
} as const satisfies Record<"regular" | "vip", ClassRowWords>;
