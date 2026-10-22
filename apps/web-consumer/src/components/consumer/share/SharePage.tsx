"use client";

import type { MouseEvent } from "react";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import {
  CHANNEL_ICONS,
  type ShareChannel,
} from "@/components/consumer/share/channel-icons";
import {
  APP_SHARE_TEXT,
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
      className="border-border aspect-[1200/630] h-auto w-full rounded-2xl border"
      data-share-card
    />
  );
}

function SendButton({
  label,
  href,
  onClick,
  data,
}: {
  label: string;
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  data: ShareChannel;
}) {
  const { tint, icon } = CHANNEL_ICONS[data];
  const className =
    "group flex flex-col items-center gap-1.5 text-xs font-semibold";
  const body = (
    <>
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition group-hover:opacity-90 group-active:scale-95",
          tint,
        )}
        data-share-icon={data}
      >
        {icon}
      </span>
      {label}
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

export function SharePage() {
  return (
    <div
      className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8"
      data-share-page
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Share Mesita
      </h1>
      <p className="text-muted-foreground type-body mt-1">{APP_SHARE_TEXT}</p>

      <div className="mt-5">
        <ShareCard />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <SectionEyebrow>Send it</SectionEyebrow>
        <div className="grid grid-cols-4 gap-2">
          <SendButton label="SMS" href={SHARE_LINKS.sms} data="sms" />
          <SendButton
            label="Instagram"
            href={INSTAGRAM_DM_URL}
            onClick={(event) => {
              event.preventDefault();
              void sendToInstagram();
            }}
            data="instagram"
          />
          <SendButton
            label="WhatsApp"
            href={SHARE_LINKS.whatsapp}
            data="whatsapp"
          />
          <SendButton
            label="Other"
            onClick={() => void sendElsewhere()}
            data="other"
          />
        </div>
      </div>
      {/* What the buttons above send, said plainly. */}
      <p
        className="text-muted-foreground type-body mt-5 text-center"
        data-share-preview
      >
        Sends: “{SHARE_BODY}”
      </p>
    </div>
  );
}
