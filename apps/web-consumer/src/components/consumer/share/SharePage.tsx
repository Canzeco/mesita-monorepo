"use client";

import { useRef, useState, type MouseEvent } from "react";
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
  SHARE_JOKES,
  nearestCard,
  shareBody,
  shareLinks,
} from "@/lib/share-app";
import { copyToClipboard, shareOrCopy } from "@/lib/share-place";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// SHARE — the bar's fourth tab, a page of its own (Pato, MESITA-2566: "no
// share create a dedicate page for share. you know.").
//
//   ┌──────────────────────────┐┌──
//   │ M Mesita                 ││ M   ten plain Mesita cards, one joke
//   │                          ││     each, in a row you swipe (Pato,
//   │ Table for two? 👀        ││ T   MESITA-2573: "just a stupid card of
//   │ consumer.mesita.ai       ││ c   mesita with nothing else")
//   └──────────────────────────┘└──
//            ● ○ ○ ○ ○ ○ ○ ○ ○ ○        which card is in view; tap to go
//   SEND IT  (SMS) (Instagram) (WhatsApp) (Other)
//
// THE CARD IN VIEW IS THE ONE THAT TRAVELS: its joke, then the link. No
// image is sent. ONE OUTCOME PER TAP, ONE TOAST AT MOST: closing the phone's
// sheet is a decision (AbortError, silent); a sheet that is missing or will
// not open copies instead, and says so (shareOrCopy, MESITA-2581). The link
// carries nothing about the guest (share-app.ts).

const LINK_LABEL = APP_SHARE_URL.replace(/^https:\/\//, "").replace(/\/$/, "");

function JokeCard({ joke, index }: { joke: string; index: number }) {
  return (
    <div
      className="bg-foreground text-background relative flex aspect-[4/3] w-[85%] shrink-0 snap-center flex-col overflow-hidden rounded-3xl p-5 shadow-lg"
      role="group"
      aria-roledescription="card"
      aria-label={`${index + 1} of ${SHARE_JOKES.length}`}
      data-share-card={index}
    >
      {/* A big faint mark in the corner: the card's watermark. */}
      <MesitaMark className="pointer-events-none absolute -right-8 -bottom-10 h-44 w-44 opacity-10" />
      <span className="relative flex items-center gap-1.5 text-sm font-semibold">
        <MesitaMark className="h-5 w-5" />
        Mesita
      </span>
      <p
        className="font-display relative mt-auto line-clamp-3 text-2xl leading-tight font-semibold tracking-tight"
        data-share-joke
      >
        {joke}
      </p>
      <span className="type-meta relative mt-3 font-medium opacity-70">
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
 * Instagram cannot be prefilled from the web, so: copy the joke and link
 * FIRST (while this page still has focus — a tab opened first makes Chrome
 * refuse the write), say so, then open the inbox to paste into a chat.
 */
async function sendToInstagram(joke: string) {
  if (await copyToClipboard(shareBody(joke)))
    toast.success("Copied: paste it in an Instagram chat");
  else toast.error("Couldn't copy the message: paste it yourself");
  openOutside(INSTAGRAM_DM_URL);
}

/** Other: the phone's share sheet, or a copy where there is none. */
function sendElsewhere(joke: string) {
  return shareOrCopy(
    { title: "Mesita", text: joke, url: APP_SHARE_URL },
    {
      text: shareBody(joke),
      copied: "Message and link copied",
      failed: "Couldn't copy the message",
    },
  );
}

export function SharePage() {
  const [index, setIndex] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const joke = SHARE_JOKES[index];
  const links = shareLinks(joke);

  // The swipe picks the card: whichever sits nearest the row's centre.
  const onScroll = () => {
    const row = rowRef.current;
    if (!row) return;
    const cards = Array.from(row.children) as HTMLElement[];
    const next = nearestCard(
      row.scrollLeft + row.clientWidth / 2,
      cards.map((c) => c.offsetLeft + c.offsetWidth / 2),
    );
    if (next !== index) setIndex(next);
  };

  const goTo = (i: number) => {
    setIndex(i);
    const card = rowRef.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div
      className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8"
      data-share-page
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Share Mesita
      </h1>
      <p className="text-muted-foreground type-body mt-1">{APP_SHARE_TEXT}</p>

      <div
        ref={rowRef}
        onScroll={onScroll}
        className="scrollbar-hide -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3"
        aria-label="Pick a card"
        data-share-cards
      >
        {SHARE_JOKES.map((j, i) => (
          <JokeCard key={j} joke={j} index={i} />
        ))}
      </div>

      <div className="mt-1 flex justify-center gap-1.5">
        {SHARE_JOKES.map((j, i) => (
          <button
            key={j}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Card ${i + 1}`}
            aria-pressed={i === index}
            className="flex h-6 w-4 items-center justify-center"
            data-share-dot={i}
          >
            <span
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "bg-foreground w-4" : "bg-foreground/20 w-1.5",
              )}
            />
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <SectionEyebrow>Send it</SectionEyebrow>
        <div className="grid grid-cols-4 gap-2">
          <SendButton label="SMS" href={links.sms} data="sms" />
          <SendButton
            label="Instagram"
            href={INSTAGRAM_DM_URL}
            onClick={(event) => {
              event.preventDefault();
              void sendToInstagram(joke);
            }}
            data="instagram"
          />
          <SendButton label="WhatsApp" href={links.whatsapp} data="whatsapp" />
          <SendButton
            label="Other"
            onClick={() => void sendElsewhere(joke)}
            data="other"
          />
        </div>
      </div>
      {/* What the buttons above send, said plainly. */}
      <p
        className="text-muted-foreground type-body mt-5 text-center"
        data-share-preview
      >
        Sends: “{shareBody(joke)}”
      </p>
    </div>
  );
}
