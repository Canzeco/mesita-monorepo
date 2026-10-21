"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronRight,
  Dices,
  Ellipsis,
  MessageCircle,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import { MesitaMark } from "@/components/brand/MesitaMark";
import {
  IconCircle,
  RowDivider,
  SectionEyebrow,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { Instagram } from "@/components/shared/instagram-icon";
import {
  APP_SHARE_TEXT,
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_CARD_IMAGES,
  SHARE_CARD_STYLES,
  SHARE_MESSAGES,
  otherIndex,
  shareBody,
  shareLinks,
  type ShareCardImage,
  type ShareCardStyle,
} from "@/lib/share-app";
import { canShareNatively, copyToClipboard } from "@/lib/share-place";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// SHARE — the bar's fourth tab, a page of its own (Pato, MESITA-2566: "no
// share create a dedicate page for share. you know.").
//
//   ┌────────────────────────────────┐
//   │ M Mesita       🐶       INVITE │   the invite card: gift-card shape,
//   │                                │   no amount, no credit, no code
//   │ Stop asking me where to eat.   │   (Pato, MESITA-2568: "like it must
//   │ Use this. 🙄                   │   look like a gift card but without
//   │ consumer.mesita.ai  No credit. │   credit … meme style"), built from
//   └────────────────────────────────┘   three params (MESITA-2570)
//   IMAGE     ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢   🎲   five meme animals, five cities;
//   MESSAGE   [chip] [chip] [chip] …      🎲 shuffles all three
//   STYLE     ● ● ● ● ●                  the tint under the words
//   SEND IT   SMS · Instagram · WhatsApp · Other
//
// ONLY THE MESSAGE TRAVELS, then the link. The image and the style dress this
// page; no image is sent. ONE OUTCOME PER TAP, ONE TOAST AT MOST: closing the
// phone's sheet is a decision (AbortError, silent), and nothing falls through
// to a second action. The link carries nothing about the guest (share-app.ts).

const noop = () => () => {};

/** The phone's share sheet exists. False on the server and on desktop. */
function useCanShare(): boolean {
  return useSyncExternalStore(noop, canShareNatively, () => false);
}

/** The photo (the card's top 70%) fades into the style's tint: a light veil
 *  under the top row, clear through the middle, solid from 70% down, under
 *  the headline and the footer. */
function scrim(tint: string): string {
  return `linear-gradient(to bottom, rgb(${tint} / 0.45) 0%, rgb(${tint} / 0) 20%, rgb(${tint} / 0) 44%, rgb(${tint}) 70%)`;
}

function InviteCard({
  message,
  image,
  look,
}: {
  message: string;
  image: ShareCardImage;
  look: ShareCardStyle;
}) {
  // A photo that failed stays off; the card is then the plain style. Before
  // hydration, alt="" keeps a broken photo from drawing anything.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const showPhoto = !failed.has(image.src);
  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full overflow-hidden rounded-3xl p-5 shadow-lg ring-1 ring-black/5",
        look.ink,
      )}
      style={{ background: look.background }}
      data-invite-card={look.id}
      data-invite-image={image.id}
    >
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.src}
          src={image.src}
          alt=""
          aria-hidden
          decoding="async"
          onError={() => setFailed((f) => new Set(f).add(image.src))}
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%] w-full object-cover"
          data-invite-photo
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: scrim(look.tint) }}
        aria-hidden
      />
      {/* A big faint mark in the corner: the card's watermark. */}
      <MesitaMark className="pointer-events-none absolute -right-8 -bottom-10 h-44 w-44 opacity-10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <MesitaMark className="h-5 w-5" />
            Mesita
          </span>
          <span className="type-meta font-semibold tracking-[0.2em] uppercase opacity-80">
            Invite
          </span>
        </div>
        <p
          className="font-display mt-auto line-clamp-3 text-2xl leading-tight font-semibold tracking-tight"
          data-invite-message
        >
          {message}
        </p>
        <div className="type-meta mt-3 flex items-center justify-between font-medium opacity-80">
          <span>
            {APP_SHARE_URL.replace(/^https:\/\//, "").replace(/\/$/, "")}
          </span>
          <span>No credit. Just vibes.</span>
        </div>
      </div>
    </div>
  );
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

/** Instagram: the row's link opens the inbox; this copies what to paste. */
async function copyForInstagram(message: string) {
  if (await copyToClipboard(shareBody(message)))
    toast.success("Message copied: paste it in a chat");
  else toast.error("Couldn't copy the message");
}

/** Other, where there is no share sheet (desktop): copy, paste anywhere. */
async function copyMessage(message: string) {
  if (await copyToClipboard(shareBody(message)))
    toast.success("Message and link copied");
  else toast.error("Couldn't copy the message");
}

async function openShareSheet(message: string) {
  try {
    await navigator.share({
      title: "Mesita",
      text: message,
      url: APP_SHARE_URL,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    toast.error("Couldn't open the share sheet");
  }
}

export function SharePage() {
  const canShare = useCanShare();
  const [imageIndex, setImageIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [styleIndex, setStyleIndex] = useState(0);
  const image = SHARE_CARD_IMAGES[imageIndex];
  const message = SHARE_MESSAGES[messageIndex];
  const look = SHARE_CARD_STYLES[styleIndex];
  const links = shareLinks(message);

  // 🎲: a new image, message and style, each different from the last.
  const shuffle = () => {
    setImageIndex((i) => otherIndex(i, SHARE_CARD_IMAGES.length));
    setMessageIndex((i) => otherIndex(i, SHARE_MESSAGES.length));
    setStyleIndex((i) => otherIndex(i, SHARE_CARD_STYLES.length));
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

      <div className="mt-5">
        <InviteCard message={message} image={image} look={look} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionEyebrow>Image</SectionEyebrow>
          <button
            type="button"
            onClick={shuffle}
            aria-label="Shuffle the card"
            className="text-foreground/70 hover:bg-muted flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition"
            data-share-shuffle
          >
            <Dices className="h-4 w-4" aria-hidden />
            Shuffle
          </button>
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {SHARE_CARD_IMAGES.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setImageIndex(i)}
              aria-label={img.label}
              aria-pressed={i === imageIndex}
              className={cn(
                "bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/10 transition",
                i === imageIndex && "ring-foreground ring-2 ring-offset-2",
              )}
              data-share-image={img.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <SectionEyebrow>Message</SectionEyebrow>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {SHARE_MESSAGES.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setMessageIndex(i)}
              aria-pressed={i === messageIndex}
              className={cn(
                "max-w-[15rem] shrink-0 truncate rounded-full border px-3 py-2 text-sm transition",
                i === messageIndex
                  ? "bg-foreground text-background border-transparent font-semibold"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
              data-share-message
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <SectionEyebrow>Style</SectionEyebrow>
        <div className="flex gap-3">
          {SHARE_CARD_STYLES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyleIndex(i)}
              aria-label={s.label}
              aria-pressed={i === styleIndex}
              className={cn(
                "h-10 w-10 rounded-full ring-1 ring-black/10 transition",
                i === styleIndex && "ring-foreground ring-2 ring-offset-2",
              )}
              style={{ background: s.background }}
              data-share-style={s.id}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SettingsGroup title="Send it">
          <Row Icon={MessageSquare} label="SMS" href={links.sms} data="sms" />
          <RowDivider />
          <Row
            Icon={Instagram}
            label="Instagram"
            sub="Copies the message, then opens Instagram"
            href={INSTAGRAM_DM_URL}
            onClick={() => void copyForInstagram(message)}
            data="instagram"
          />
          <RowDivider />
          <Row
            Icon={MessageCircle}
            label="WhatsApp"
            href={links.whatsapp}
            data="whatsapp"
          />
          <RowDivider />
          <Row
            Icon={Ellipsis}
            label="Other"
            sub={
              canShare ? "Any app on your phone" : "Copies the message and link"
            }
            onClick={() =>
              void (canShare ? openShareSheet(message) : copyMessage(message))
            }
            data="other"
          />
        </SettingsGroup>
      </div>
      {/* What the channels above send, said plainly. */}
      <p
        className="text-muted-foreground type-body mt-3 text-center"
        data-share-preview
      >
        Sends: “{shareBody(message)}”
      </p>
    </div>
  );
}
