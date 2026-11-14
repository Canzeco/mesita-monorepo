import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { Screen } from "@/components/consumer/nav/Screen";
import { IconChip } from "@/components/consumer/me/settings-rows";
import {
  CHANNEL_MARKS,
  type ShareChannel,
} from "@/components/consumer/share/channel-icons";
import { APP_SHARE_TEXT } from "@/lib/share-app";
import { cn } from "@/lib/utils";

// /SHARE (Pato, 2026-11-14, MESITA-3867: "design the /share page … keep it
// simple. just a button to share in different channels … not really a weird
// card not something fancy"):
//
//   ┌──────────────────────────────┐
//   │ ‹        Share Mesita        │  the pushed page's header (Screen)
//   ├──────────────────────────────┤
//   │ Send Mesita to a friend.     │
//   │ ┌──────────────────────────┐ │  grey ground
//   │ │ (wa)  WhatsApp         ↗ │ │
//   │ │ (ig)  Instagram        ↗ │ │
//   │ │       Copy, then paste…  │ │
//   │ │ (sms) Messages         ↗ │ │  touch only
//   │ │ (🔗)  Copy link          │ │
//   │ │ (···) More               │ │  touch only
//   │ └──────────────────────────┘ │
//   └──────────────────────────────┘
//
// A PAGE PUSHED FROM WALLET'S BIG SHARE BUTTON (MESITA-3886), with Back; it
// lights Wallet. It was the bar's Share tab from MESITA-3867 until Wallet took
// the slot.
//
// ONE SOURCE FOR THE PAGE AND ITS FALLBACK (MESITA-2701): SharePage and
// share/loading.tsx both draw ShareFrame and these rows, so nothing moves on
// arrival. A plain module: loading.tsx is a server file.
//
// MESSAGES AND MORE ARE TOUCH-ONLY, BY CSS (`pointer-coarse`): a computer has
// no reliable sms: handler and no share sheet worth a row, so it shows three
// rows. CSS, not script, so the server render and the page are one markup.
// Bare `(pointer: coarse)` on purpose, not the app's `(hover: none) and
// (pointer: coarse)`: a touch phone with a mouse still has Messages.
//
// EACH ROW DRAWS ITS OWN TOP HAIRLINE (the first draws none), so a hidden row
// takes its line with it and no two lines meet.

export type ShareRowSpec = {
  channel: ShareChannel;
  label: string;
  /** The muted second line, where the row needs one (Instagram). */
  sub?: string;
  /** The row's spoken name: what the tap does. */
  name: string;
  /** Leaves the app: an arrow out at the right. */
  leaves: boolean;
  /** Shown on touch devices only. */
  touchOnly: boolean;
};

/** The rows, in order: WhatsApp first, the channel Monterrey uses. */
export const SHARE_ROWS: readonly ShareRowSpec[] = [
  {
    channel: "whatsapp",
    label: "WhatsApp",
    name: "Share on WhatsApp",
    leaves: true,
    touchOnly: false,
  },
  {
    channel: "instagram",
    label: "Instagram",
    sub: "Copy, then paste in a chat",
    name: "Share on Instagram",
    leaves: true,
    touchOnly: false,
  },
  {
    channel: "messages",
    label: "Messages",
    name: "Share by Messages",
    leaves: true,
    touchOnly: true,
  },
  {
    channel: "copy",
    label: "Copy link",
    name: "Copy link",
    leaves: false,
    touchOnly: false,
  },
  {
    channel: "more",
    label: "More",
    name: "More ways to share",
    leaves: false,
    touchOnly: true,
  },
];

/** A row's box: 56px tall at least, the whole row the target. Hover only
 *  where there is hover (Tailwind's `hover:`), lighter than the chip. */
export function shareRowClass(spec: ShareRowSpec): string {
  return cn(
    "border-border/60 flex min-h-14 w-full items-center gap-3 border-t px-4 py-2.5 text-left transition first:border-t-0",
    "hover:bg-muted/50 active:bg-muted/50 focus-visible:ring-foreground/25 outline-none focus-visible:ring-2 focus-visible:ring-inset",
    spec.touchOnly && "hidden pointer-coarse:flex",
  );
}

/** What a row shows: the chip, the words, an arrow out when it leaves. */
export function ShareRowBody({ spec }: { spec: ShareRowSpec }) {
  return (
    <>
      <IconChip>{CHANNEL_MARKS[spec.channel]}</IconChip>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{spec.label}</span>
        {spec.sub ? (
          <span className="text-muted-foreground type-label block">
            {spec.sub}
          </span>
        ) : null}
      </span>
      {spec.leaves ? (
        <ArrowUpRight
          className="text-muted-foreground h-4 w-4 shrink-0"
          aria-hidden
        />
      ) : null}
    </>
  );
}

/** The page: the pushed page's header with Back, the line, then the one
 *  card of rows. `children` follow (the fallback's status). */
export function ShareFrame({
  rows,
  children,
}: {
  rows: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Screen title="Share Mesita" flush>
      <div className="flex flex-col px-4 pt-4 pb-8" data-share-page>
        <p className="text-muted-foreground type-body mb-4">{APP_SHARE_TEXT}</p>
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          {rows}
        </div>
        {children}
      </div>
    </Screen>
  );
}
