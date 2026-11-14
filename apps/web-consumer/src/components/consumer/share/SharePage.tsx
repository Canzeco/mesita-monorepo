"use client";

import { useRef, type MouseEvent } from "react";

import {
  SHARE_ROWS,
  ShareFrame,
  ShareRowBody,
  shareRowClass,
  type ShareRowSpec,
} from "@/components/consumer/share/share-frame";
import type { ShareChannel } from "@/components/consumer/share/channel-icons";
import {
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_BODY,
  SHARE_LINKS,
  SHARE_MESSAGE,
} from "@/lib/share-app";
import {
  copyToClipboard,
  copyWithTextarea,
  shareOrCopy,
} from "@/lib/share-place";
import { toast } from "@/lib/toast";

// /share's rows and what each tap does (MESITA-3867). The layout is
// ShareFrame (share-frame.tsx), the same one loading.tsx draws.
//
// ONE OUTCOME PER TAP, ONE TOAST AT MOST (shareOrCopy, MESITA-2581).
// WHAT TRAVELS: the message, then mesita.ai, with nothing about the guest
// (share-app.ts). Copy link, and More with no sheet, copy the link alone.

/** Copy the link, and say so. */
async function copyLink() {
  if (await copyToClipboard(APP_SHARE_URL)) toast.success("Link copied");
  else toast.error("Couldn't copy the link");
}

/** More: the phone's share sheet, or the link copied where there is none. */
function shareElsewhere() {
  return shareOrCopy(
    { title: "Mesita", text: SHARE_MESSAGE, url: APP_SHARE_URL },
    {
      text: APP_SHARE_URL,
      copied: "Link copied",
      failed: "Couldn't share Mesita",
    },
  );
}

const COPIED_FOR_INSTAGRAM = "Copied: paste it in an Instagram chat";
const COPY_FAILED_FOR_INSTAGRAM = "Couldn't copy the message: paste it yourself";

/** Instagram cannot be prefilled from the web. The row is a real link, so
 *  the browser itself opens the inbox (a scripted open loses the tap on iOS
 *  and in an installed app). Before it goes, the click copies the message
 *  and link SYNCHRONOUSLY, while this page still has focus; only if that
 *  fails does it try the async Clipboard API. */
function copyForInstagram() {
  if (copyWithTextarea(SHARE_BODY)) {
    toast.success(COPIED_FOR_INSTAGRAM);
    return;
  }
  void copyToClipboard(SHARE_BODY).then((ok) =>
    ok
      ? toast.success(COPIED_FOR_INSTAGRAM)
      : toast.error(COPY_FAILED_FOR_INSTAGRAM),
  );
}

/** Where a row that is a link goes, and whether it opens a new tab. */
const LINKS: Partial<Record<ShareChannel, { href: string; newTab: boolean }>> = {
  whatsapp: { href: SHARE_LINKS.whatsapp, newTab: true },
  instagram: { href: INSTAGRAM_DM_URL, newTab: true },
  // sms: hands off to Messages in this tab.
  messages: { href: SHARE_LINKS.sms, newTab: false },
};

/** What a row that is a button does. */
const ACTIONS: Partial<Record<ShareChannel, () => unknown>> = {
  copy: copyLink,
  more: shareElsewhere,
};

function ShareRow({ spec }: { spec: ShareRowSpec }) {
  // A second Instagram tap within a second is ignored: one tab, one toast.
  const lastTap = useRef(0);
  const link = LINKS[spec.channel];
  if (link) {
    const onClick =
      spec.channel === "instagram"
        ? (event: MouseEvent<HTMLAnchorElement>) => {
            const now = Date.now();
            if (now - lastTap.current < 1000) {
              event.preventDefault();
              return;
            }
            lastTap.current = now;
            copyForInstagram();
          }
        : undefined;
    return (
      <a
        href={link.href}
        onClick={onClick}
        {...(link.newTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        aria-label={spec.name}
        className={shareRowClass(spec)}
        data-share-row={spec.channel}
      >
        <ShareRowBody spec={spec} />
      </a>
    );
  }
  const action = ACTIONS[spec.channel];
  return (
    <button
      type="button"
      onClick={() => void action?.()}
      aria-label={spec.name}
      className={shareRowClass(spec)}
      data-share-row={spec.channel}
    >
      <ShareRowBody spec={spec} />
    </button>
  );
}

export function SharePage() {
  return (
    <ShareFrame
      rows={SHARE_ROWS.map((spec) => (
        <ShareRow key={spec.channel} spec={spec} />
      ))}
    />
  );
}
