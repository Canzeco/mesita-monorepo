"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  Ellipsis,
  MessageCircle,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import { MesitaMark } from "@/components/brand/MesitaMark";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { Instagram } from "@/components/shared/instagram-icon";
import {
  APP_SHARE_TEXT,
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_JOKES,
  nearestCard,
  shareBody,
  shareLinks,
} from "@/lib/share-app";
import { canShareNatively, copyToClipboard } from "@/lib/share-place";
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
// sheet is a decision (AbortError, silent), and nothing falls through to a
// second action. The link carries nothing about the guest (share-app.ts).

const noop = () => () => {};

/** The phone's share sheet exists. False on the server and on desktop. */
function useCanShare(): boolean {
  return useSyncExternalStore(noop, canShareNatively, () => false);
}

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
  Icon,
  label,
  href,
  onClick,
  data,
}: {
  Icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  data: string;
}) {
  const className =
    "group flex flex-col items-center gap-1.5 text-xs font-semibold";
  const body = (
    <>
      <span className="bg-card group-hover:bg-muted flex h-14 w-14 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition">
        <Icon className="h-6 w-6" aria-hidden />
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

/** Instagram: the button's link opens the inbox; this copies what to paste. */
async function copyForInstagram(joke: string) {
  if (await copyToClipboard(shareBody(joke)))
    toast.success("Message copied: paste it in a chat");
  else toast.error("Couldn't copy the message");
}

/** Other, where there is no share sheet (desktop): copy, paste anywhere. */
async function copyMessage(joke: string) {
  if (await copyToClipboard(shareBody(joke)))
    toast.success("Message and link copied");
  else toast.error("Couldn't copy the message");
}

async function openShareSheet(joke: string) {
  try {
    await navigator.share({ title: "Mesita", text: joke, url: APP_SHARE_URL });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    toast.error("Couldn't open the share sheet");
  }
}

export function SharePage() {
  const canShare = useCanShare();
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
          <SendButton
            Icon={MessageSquare}
            label="SMS"
            href={links.sms}
            data="sms"
          />
          <SendButton
            Icon={Instagram}
            label="Instagram"
            href={INSTAGRAM_DM_URL}
            onClick={() => void copyForInstagram(joke)}
            data="instagram"
          />
          <SendButton
            Icon={MessageCircle}
            label="WhatsApp"
            href={links.whatsapp}
            data="whatsapp"
          />
          <SendButton
            Icon={Ellipsis}
            label="Other"
            onClick={() =>
              void (canShare ? openShareSheet(joke) : copyMessage(joke))
            }
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
