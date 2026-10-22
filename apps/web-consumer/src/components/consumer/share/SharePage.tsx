"use client";

import type { MouseEvent } from "react";
import { MesitaMark } from "@/components/brand/MesitaMark";
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
//   │ M Mesita                     │   one plain Mesita card, one message
//   │                              │   (Pato, MESITA-2622: "just one card.
//   │ Stop asking me where to eat. │   keep it clearer."; it replaced ten
//   │ Use this. 🙄                 │   cards in a swipe row, MESITA-2573)
//   │ consumer.mesita.ai           │
//   └──────────────────────────────┘
//   SEND IT  (SMS) (Instagram) (WhatsApp) (Other)
//
// THE CARD IS WHAT TRAVELS: its message, then the link. No image is sent.
// ONE OUTCOME PER TAP, ONE TOAST AT MOST: closing the phone's sheet is a
// decision (AbortError, silent); a sheet that is missing or will not open
// copies instead, and says so (shareOrCopy, MESITA-2581). The link carries
// nothing about the guest (share-app.ts).

const LINK_LABEL = APP_SHARE_URL.replace(/^https:\/\//, "").replace(/\/$/, "");

function ShareCard() {
  return (
    <div
      className="bg-foreground text-background flex aspect-[4/3] w-full flex-col rounded-3xl p-5 shadow-lg"
      data-share-card
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <MesitaMark className="h-5 w-5" />
        Mesita
      </span>
      <p
        className="font-display mt-auto text-2xl leading-tight font-semibold tracking-tight"
        data-share-message
      >
        {SHARE_MESSAGE}
      </p>
      <span className="type-meta mt-3 font-medium opacity-70">
        {LINK_LABEL}
      </span>
    </div>
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
