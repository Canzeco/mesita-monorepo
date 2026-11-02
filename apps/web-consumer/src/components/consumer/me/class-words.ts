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

/** The one line over the card: what a class is for. */
export const CLASS_LEAD =
  "Your class sets which Rewards you can get. The higher your class, the better the Rewards.";

export const CLASS_ROWS = {
  regular: {
    title: "Regular Class",
    subtitle: "Every member starts here.",
    soon: true,
  },
  vip: {
    title: "VIP Class",
    subtitle:
      "Through Mesita's partners, like modeling agencies and creator partnerships. Never bought.",
    soon: true,
  },
} as const satisfies Record<"regular" | "vip", ClassRowWords>;
