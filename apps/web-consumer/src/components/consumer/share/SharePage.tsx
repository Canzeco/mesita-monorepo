"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronRight,
  Copy,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  Share,
  type LucideIcon,
} from "lucide-react";

import {
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import {
  APP_SHARE_LINKS,
  APP_SHARE_TEXT,
  APP_SHARE_URL,
} from "@/lib/share-app";
import { canShareNatively, copyToClipboard } from "@/lib/share-place";
import { toast } from "@/lib/toast";

// SHARE — the bar's fourth tab, a page of its own (Pato, MESITA-2566: "no
// share create a dedicate page for share. you know."). It was a tap that
// fired the share sheet and fell back to the clipboard, which on some phones
// showed "Link copied" and "Couldn't share Mesita" at once.
//
//   (plane)  Share Mesita
//            Find great places to eat and book a table with Mesita.
//   [ consumer.mesita.ai/                       Copy ]
//   Share…     the phone's own sheet — only where there is one
//   WhatsApp · Messages · Email                 each prefilled with the line
//   Copy link
//
// ONE OUTCOME PER TAP, ONE TOAST AT MOST. Closing the phone's sheet is a
// decision, not a failure (AbortError, silent). Nothing falls through to a
// second action. The link carries nothing about the guest (share-app.ts).

const noop = () => () => {};

/** The phone's share sheet exists. False on the server and on desktop. */
function useCanShare(): boolean {
  return useSyncExternalStore(noop, canShareNatively, () => false);
}

function Row({
  Icon,
  label,
  sub,
  href,
  onClick,
  data,
}: {
  Icon: LucideIcon;
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  data: string;
}) {
  const body: ReactNode = (
    <>
      <IconCircle tint="muted">
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {sub && (
          <span className="text-muted-foreground type-label block truncate">
            {sub}
          </span>
        )}
      </span>
      <ChevronRight
        className="text-muted-foreground h-4 w-4 shrink-0"
        aria-hidden
      />
    </>
  );
  const className =
    "hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition";
  if (href) {
    return (
      <a
        href={href}
        // WhatsApp opens in a new tab; sms: and mailto: hand off to an app.
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

async function copyLink() {
  if (await copyToClipboard(APP_SHARE_URL)) toast.success("Link copied");
  else toast.error("Couldn't copy the link");
}

async function openShareSheet() {
  try {
    await navigator.share({
      title: "Mesita",
      text: APP_SHARE_TEXT,
      url: APP_SHARE_URL,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    toast.error("Couldn't open the share sheet");
  }
}

export function SharePage() {
  const canShare = useCanShare();
  const shown = APP_SHARE_URL.replace(/^https:\/\//, "");
  return (
    <div
      className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-8 pb-8"
      data-share-page
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl"
          aria-hidden
        >
          <Send className="h-6 w-6" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Share Mesita
        </h1>
        <p className="text-muted-foreground type-body max-w-xs">
          {APP_SHARE_TEXT}
        </p>
      </div>

      <div className="border-border bg-card mt-6 flex items-center gap-2 rounded-2xl border py-2 pr-2 pl-4">
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          data-share-link
        >
          {shown}
        </span>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="bg-foreground text-background flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98]"
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copy
        </button>
      </div>

      <div className="mt-6">
        <SettingsGroup title="Send it">
          {canShare && (
            <>
              <Row
                Icon={Share}
                label="Share…"
                sub="Any app on your phone"
                onClick={() => void openShareSheet()}
                data="sheet"
              />
              <RowDivider />
            </>
          )}
          <Row
            Icon={MessageCircle}
            label="WhatsApp"
            href={APP_SHARE_LINKS.whatsapp}
            data="whatsapp"
          />
          <RowDivider />
          <Row
            Icon={MessageSquare}
            label="Messages"
            href={APP_SHARE_LINKS.sms}
            data="sms"
          />
          <RowDivider />
          <Row
            Icon={Mail}
            label="Email"
            href={APP_SHARE_LINKS.email}
            data="email"
          />
          <RowDivider />
          <Row
            Icon={Copy}
            label="Copy link"
            onClick={() => void copyLink()}
            data="copy"
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
