"use client";

import type { MouseEvent } from "react";
import {
  CHANNEL_ICONS,
  type ShareChannel,
} from "@/components/consumer/share/channel-icons";
import {
  SEND_CHANNELS,
  SEND_DISC,
  SEND_DOOR,
  SEND_LABELS,
  SHARE_CARD_BOX,
  ShareFrame,
} from "@/components/consumer/share/share-frame";
import {
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_BODY,
  SHARE_CARD,
  SHARE_LINKS,
  SHARE_MESSAGE,
} from "@/lib/share-app";
import { copyToClipboard, shareOrCopy } from "@/lib/share-place";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// SHARE — the bar's fourth tab, a page of its own (Pato, MESITA-2566: "no
// share create a dedicate page for share. you know.").
//
//   ┌──────────────────────────────┐
//   │ Mesita                       │   the standard Mesita share card, the
//   │ Discover and reserve.        │   real 1200×630 link preview
//   │ ──────────────────────────── │   (MESITA-2639); one card since
//   │ consumer.mesita.ai           │   MESITA-2622, ten before (MESITA-2573)
//   └──────────────────────────────┘
//   SEND IT  (SMS) (Instagram) (WhatsApp) (Other)
//
// WHAT TRAVELS IS THE MESSAGE, THEN THE LINK; the link unfurls into the
// card above in the recipient's chat (og:image).
// ONE OUTCOME PER TAP, ONE TOAST AT MOST: closing the phone's sheet is a
// decision (AbortError, silent); a sheet that is missing or will not open
// copies instead, and says so (shareOrCopy, MESITA-2581). The link carries
// nothing about the guest (share-app.ts).

function ShareCard() {
  // THE STANDARD MESITA SHARE CARD (Pato, MESITA-2639: "just use a standard
  // Mesita share card and use the standard card dimensions"): the real
  // 1200×630 link preview, the same file every shared link unfurls with
  // (og:image). It replaced a hand-drawn 4:3 black block with a serif line,
  // a mock of a preview that did not exist.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SHARE_CARD.src}
      width={SHARE_CARD.width}
      height={SHARE_CARD.height}
      alt={SHARE_CARD.alt}
      className={cn("border-border h-auto border", SHARE_CARD_BOX)}
      data-share-card
    />
  );
}

/** What a door does on a tap: a prefilled link, a handler, or both. */
type Door = {
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

function SendButton({ href, onClick, data }: Door & { data: ShareChannel }) {
  const { tint, icon } = CHANNEL_ICONS[data];
  const className = cn("group", SEND_DOOR);
  const body = (
    <>
      <span
        className={cn(
          SEND_DISC,
          "shadow-sm transition group-hover:opacity-90 group-active:scale-95",
          tint,
        )}
        data-share-icon={data}
      >
        {icon}
      </span>
      {SEND_LABELS[data]}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        // WhatsApp and Instagram open in a new tab (or their app); sms:
        // hands off to Messages.
        {...(href.startsWith("https:")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className={className}
        data-share-row={data}
      >
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      data-share-row={data}
    >
      {body}
    </button>
  );
}

/** Opens an outside link in a new tab, or this one where popups are blocked. */
function openOutside(url: string) {
  const tab = window.open(url, "_blank");
  if (tab) tab.opener = null;
  else window.location.assign(url);
}

/**
 * Instagram cannot be prefilled from the web, so: copy the message and link
 * FIRST (while this page still has focus — a tab opened first makes Chrome
 * refuse the write), say so, then open the inbox to paste into a chat.
 */
async function sendToInstagram() {
  if (await copyToClipboard(SHARE_BODY))
    toast.success("Copied: paste it in an Instagram chat");
  else toast.error("Couldn't copy the message: paste it yourself");
  openOutside(INSTAGRAM_DM_URL);
}

/** Other: the phone's share sheet, or a copy where there is none. */
function sendElsewhere() {
  return shareOrCopy(
    { title: "Mesita", text: SHARE_MESSAGE, url: APP_SHARE_URL },
    {
      text: SHARE_BODY,
      copied: "Message and link copied",
      failed: "Couldn't copy the message",
    },
  );
}

/** Each way to send, in SEND_CHANNELS' order (share-frame.tsx). */
const DOORS: Record<ShareChannel, Door> = {
  sms: { href: SHARE_LINKS.sms },
  instagram: {
    href: INSTAGRAM_DM_URL,
    onClick: (event) => {
      event.preventDefault();
      void sendToInstagram();
    },
  },
  whatsapp: { href: SHARE_LINKS.whatsapp },
  other: { onClick: () => void sendElsewhere() },
};

export function SharePage() {
  // The scroller, the words and the Send it row are ShareFrame, the same
  // one share/loading.tsx draws (MESITA-2701).
  return (
    <ShareFrame
      data-share-page
      card={<ShareCard />}
      doors={SEND_CHANNELS.map((channel) => (
        <SendButton key={channel} data={channel} {...DOORS[channel]} />
      ))}
    />
  );
}
