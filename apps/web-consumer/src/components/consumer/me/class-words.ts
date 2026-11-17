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
// are VIP. easy peasy"; more than 1,000 since MESITA-4249, Pato 2026-11-17:
// "to be VIP you only need more than 1,000 followers"): nothing here joins or
// leaves one. No offer names a Class (MESITA-4249: the VIP offer is gone).

/** A class as a card (MESITA-3905): its name and what it brings, as checks. */
export type ClassRowWords = {
  title: string;
  perks: readonly string[];
};

/** The VIP bar (MESITA-4249): MORE THAN 1,000 verified followers. The server
 *  owns the rule (consumers.guest_class is generated); this is only for the
 *  progress line and must equal it. */
export const VIP_FOLLOWERS = 1000;

/** The status card's words (MESITA-3873). */
export const CLASS_STATUS = {
  title: { regular: "Regular Class", vip: "VIP Class" },
  noInstagram: "Connect your Instagram. Above 1,000 followers you're VIP.",
  toGo: (n: string) => `${n} more followers to VIP`,
  countUnknown: "Sync your followers to see how close you are to VIP.",
  vip: "You're VIP: more than 1,000 Instagram followers.",
  unknown: "Couldn't load your class.",
  connect: { label: "Connect Instagram", sub: "Takes a minute" },
  sync: "Sync your followers",
  progressLabel: "Followers toward VIP",
} as const;

/** The pill beside the guest's own class: Plan's Current pill (MESITA-4052). */
export const CLASS_MINE = "Current";

export const CLASS_ROWS = {
  regular: {
    title: "Regular",
    perks: ["Everyone on Mesita", "The standard vouchers"],
  },
  vip: {
    title: "VIP",
    perks: [
      "More than 1,000 Instagram followers",
      "Never sold",
    ],
  },
} as const satisfies Record<"regular" | "vip", ClassRowWords>;
