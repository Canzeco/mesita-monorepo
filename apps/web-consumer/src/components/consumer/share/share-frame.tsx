import type { HTMLAttributes, ReactNode } from "react";

import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import type { ShareChannel } from "@/components/consumer/share/channel-icons";
import { APP_SHARE_TEXT, SHARE_BODY } from "@/lib/share-app";

// /SHARE'S FIXED PARTS, ONE SOURCE (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"). The page
// reads nothing: its scroller, title, line, Send it row and the preview line
// are fixed words and boxes. SharePage and share/loading.tsx both render
// ShareFrame and fill its two slots, the card and the four doors, so the
// fallback's words wrap where the page's do and nothing moves on arrival.
// No "use client": loading.tsx is a server file and reads the strings here.

/** The 1200×630 card's box (MESITA-2639): the image, or its loading block. */
export const SHARE_CARD_BOX = "aspect-[1200/630] w-full rounded-2xl";

/** One way to send: the disc over its 12px semibold word, 6px apart. */
export const SEND_DOOR =
  "flex flex-col items-center gap-1.5 text-xs font-semibold";

/** The door's 56px disc. */
export const SEND_DISC =
  "flex h-14 w-14 items-center justify-center rounded-full";

/** The four ways to send, in order, and the word under each disc. */
export const SEND_LABELS = {
  sms: "SMS",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  other: "Other",
} as const satisfies Record<ShareChannel, string>;

export const SEND_CHANNELS = Object.keys(SEND_LABELS) as ShareChannel[];

/** The page around the card and the doors: its own scroller, the title and
 *  its line, the card, Send it over four columns, then what the buttons send,
 *  said plainly. `children` follow it (the fallback's status line). */
export function ShareFrame({
  card,
  doors,
  children,
  ...rest
}: {
  card: ReactNode;
  doors: ReactNode;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div
      className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8"
      {...rest}
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Share Mesita
      </h1>
      <p className="text-muted-foreground type-body mt-1">{APP_SHARE_TEXT}</p>

      <div className="mt-5">{card}</div>

      <div className="mt-6 flex flex-col gap-3">
        <SectionEyebrow>Send it</SectionEyebrow>
        <div className="grid grid-cols-4 gap-2">{doors}</div>
      </div>
      <p
        className="text-muted-foreground type-body mt-5 text-center"
        data-share-preview
      >
        Sends: “{SHARE_BODY}”
      </p>
      {children}
    </div>
  );
}
