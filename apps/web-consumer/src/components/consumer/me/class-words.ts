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
// are VIP. easy peasy"; 5,000 or more since MESITA-3864): nothing here joins
// or leaves one.

export type ClassRowWords = {
  title: string;
  subtitle: string;
};

/** The VIP bar (MESITA-3864): 5,000 verified followers or more. The server
 *  owns the rule (consumers.guest_class is generated); this is only for the
 *  progress line and must equal it. */
export const VIP_FOLLOWERS = 5000;

/** The status card's words (MESITA-3873). */
export const CLASS_STATUS = {
  title: { regular: "Regular Class", vip: "VIP Class" },
  noInstagram: "Connect your Instagram. At 5,000 followers you're VIP.",
  toGo: (n: string) => `${n} more followers to VIP`,
  countUnknown: "Sync your followers to see how close you are to VIP.",
  vip: "You get the VIP voucher where a place offers it.",
  unknown: "Couldn't load your class.",
  connect: { label: "Connect Instagram", sub: "Takes a minute" },
  sync: "Sync your followers",
  progressLabel: "Followers toward VIP",
} as const;

export const CLASS_LIST_TITLE = "The two classes";

/** "You" beside the guest's own class in the list. */
export const CLASS_MINE = "You";

export const CLASS_ROWS = {
  regular: {
    title: "Regular",
    subtitle: "Everyone on Mesita. The standard vouchers.",
  },
  vip: {
    title: "VIP",
    subtitle:
      "5,000 or more followers on Instagram. Adds the VIP voucher where a place offers it. Never sold.",
  },
} as const satisfies Record<"regular" | "vip", ClassRowWords>;
