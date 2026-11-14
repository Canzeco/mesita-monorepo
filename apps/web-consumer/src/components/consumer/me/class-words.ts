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
// a buy. CLASS IS AUTOMATIC (Pato, MESITA-3850: "more than 5K followers. you
// are VIP. easy peasy"): nothing here joins or leaves one.

export type ClassRowWords = {
  title: string;
  subtitle: string;
  /** A class nobody can be in yet: a Soon tag beside the title. */
  soon?: boolean;
};

/** The one line over the card: what a class is for, in plain words (Pato,
 *  MESITA-3100: "clearer explanation"). */
export const CLASS_LEAD =
  "Your class comes from your Instagram. It updates on its own when your followers change.";

export const CLASS_ROWS = {
  regular: {
    title: "Regular Class",
    subtitle: "Everyone on Mesita. You get the standard vouchers.",
  },
  vip: {
    title: "VIP Class",
    subtitle:
      "More than 5,000 followers on your connected Instagram. You also get the VIP voucher where a place offers it. You can't buy it.",
  },
} as const satisfies Record<"regular" | "vip", ClassRowWords>;
