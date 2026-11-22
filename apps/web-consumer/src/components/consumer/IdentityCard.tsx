"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { Crown, User } from "lucide-react";
import { CLASS_LABEL, type GuestClass } from "@/lib/guest-standing";
import { Instagram } from "@/components/shared/instagram-icon";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  IDENTITY_CARD_CLASS,
  IDENTITY_INSTAGRAM_CLASS,
  IDENTITY_LINES_CLASS,
  IDENTITY_NAME_CLASS,
  IDENTITY_PHOTO_CLASS,
  IDENTITY_RING_CLASS,
} from "./identity-card-layout";

// ONE IDENTITY CARD (Pato, MESITA-2547: "that card at the top is the card.
// the card must display all public info from instagram to profile picture
// to name"). Me's header draws it for the guest (Instagram is a door there);
// Social's person card draws it for a member (Instagram is a fact: the full
// handle, MESITA-2590, or "die***" until the viewer shows their own,
// MESITA-2594). Never the phone: it is private and
// lives in Settings.
//
// PHOTO AT THE LEFT, NAME OVER INSTAGRAM AT ITS RIGHT (Pato, MESITA-4308:
// "profile-photo, name / profile-photo, instagram"):
//
//   (60px photo)  Diego                          20px bold (MESITA-4313)
//                 ◎ @diego · ~1.2K followers
//
// PLAIN TEXT, NO OUTLINES (design review D1): Instagram's own profile
// header. Before, each fact was a 36px outlined pill under a centred photo
// (MESITA-2596 … MESITA-4306). The name is the Me tiles' text-sm bold, no new
// size (D2); Instagram is text-sm in muted ink after its badge. Each line
// truncates.
//
// NO CLASS (MESITA-4306, Pato: "LETS REMOVE THE CLASS") and no Plan
// (MESITA-3830). No chevrons (MESITA-2604): a door on Me is still a link,
// it just does not draw an arrow.
//
// THE GEOMETRY IS identity-card-layout.ts's, which Me's loading skeleton
// reads too (MESITA-2701).

/** A line's tap area grows to the 44px floor without growing it visually
 *  (MESITA-1688): the name is 28px and the Instagram line 20px with 4px
 *  between, centred in the 63px ring (5.5px spare each side), and the card
 *  adds 16px of padding (MESITA-4313). So the name's area reaches up to the
 *  card's top edge and the Instagram line's down to its bottom, each meeting
 *  the other at the gap: Instagram 21.5 + 20 + 2 = 43.5px, name 49.5px. */
const NAME_TAP_CLASS =
  "after:absolute after:inset-x-0 after:-top-[21.5px] after:-bottom-0.5 after:content-['']";
const INSTAGRAM_TAP_CLASS =
  "after:absolute after:inset-x-0 after:-top-0.5 after:-bottom-[22px] after:content-['']";

/** A door's hover: the line dims, no box to fill. */
const DOOR_HOVER_CLASS = "transition-opacity hover:opacity-70";

export type IdentityInstagram = {
  /** Me: "@handle · ~25K followers" or "Connect Instagram"
   *  (MESITA-2606, MESITA-2696); Social: "@per*** · ~1.2K followers"
   *  or "No Instagram" (MESITA-2594, MESITA-2696). */
  label: string;
  /** False draws the plain ink glyph, no gradient: colour means connected
   *  (MESITA-2696). Default true. */
  connected?: boolean;
  /** A door (Me) when set; a plain fact (Social) when not. */
  href?: string;
};

function InstagramBadge({ connected = true }: { connected?: boolean }) {
  if (!connected)
    return (
      <Instagram className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    );
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        INSTAGRAM_ICON_GRADIENT_CLASS,
      )}
      aria-hidden
    >
      <Instagram className="h-3 w-3 text-white" aria-hidden />
    </span>
  );
}

/** The name line: a link on Me (opens Me › Profile), a fact on Social. */
function NameLine({ name, href }: { name: string; href?: string }) {
  const body = <span className="truncate">{name}</span>;
  return href ? (
    <PushLink
      href={href}
      aria-label={`Profile: ${name}`}
      className={cn(IDENTITY_NAME_CLASS, NAME_TAP_CLASS, DOOR_HOVER_CLASS)}
      data-identity-name
    >
      {body}
    </PushLink>
  ) : (
    <span className={IDENTITY_NAME_CLASS} data-identity-name>
      {body}
    </span>
  );
}

/** The Instagram line: a link on Me (opens /me/instagram), a fact on
 *  Social. */
function InstagramLine({ instagram }: { instagram: IdentityInstagram }) {
  return instagram.href ? (
    <PushLink
      href={instagram.href}
      // The logo says Instagram on screen (MESITA-3067); say it aloud.
      aria-label={
        instagram.label.startsWith("@")
          ? `Instagram: ${instagram.label}`
          : instagram.label
      }
      className={cn(
        IDENTITY_INSTAGRAM_CLASS,
        INSTAGRAM_TAP_CLASS,
        DOOR_HOVER_CLASS,
      )}
      data-identity-instagram
    >
      <InstagramBadge connected={instagram.connected} />
      <span className="truncate">{instagram.label}</span>
    </PushLink>
  ) : (
    <span className={IDENTITY_INSTAGRAM_CLASS} data-identity-instagram>
      <InstagramBadge connected={instagram.connected} />
      <span className="sr-only">Instagram:</span>
      <span className="truncate">{instagram.label}</span>
    </span>
  );
}

export function IdentityCard({
  name,
  avatarUrl,
  instagram,
  nameHref,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram | null;
  /** Me only: the name line opens Me › Profile. */
  nameHref?: string;
}) {
  return (
    <div className={IDENTITY_CARD_CLASS} data-identity-card>
      <span className={IDENTITY_RING_CLASS} aria-hidden>
        <span className={cn("bg-muted", IDENTITY_PHOTO_CLASS)}>
          {avatarUrl ? (
            <SizedImg
              src={avatarUrl}
              size="thumb"
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <DefaultAvatar className="h-full w-full" />
          )}
        </span>
      </span>

      <div className={IDENTITY_LINES_CLASS} data-identity-lines>
        <NameLine name={name} href={nameHref} />
        {instagram && <InstagramLine instagram={instagram} />}
      </div>
    </div>
  );
}

// ─── Me's header in modules (Pato, 2026-11-18, MESITA-4335: "put name and
// instagram inside a box with thin borders, and keep a super clean modular
// design on the header"; picked B of three mocks). Row one: the photo, then
// a 1px box with a small "Name" over the name (opens Me › Profile). Row two:
// a full-width 1px box, the Instagram badge and @handle on the left, the
// followers on the right (opens Me › Instagram; "Connect Instagram" when
// there is none). Social's member card keeps IdentityCard above.

/** Me's header pill (MESITA-4543): full width, 48px, a 1px hairline,
 *  fully rounded, the content centred in ink. */
export const IDENTITY_PILL_CLASS =
  "border-border bg-card text-foreground hover:bg-muted/60 flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition";

/** "@handle · ~320 followers" → ["@handle", "~320 followers"]. */
function splitInstagramLabel(label: string): [string, string | null] {
  const at = label.indexOf(" · ");
  return at < 0 ? [label, null] : [label.slice(0, at), label.slice(at + 3)];
}

export function IdentityModules({
  name,
  avatarUrl,
  instagram,
  nameHref,
  guestClass = "regular",
  privacy = null,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram & { href: string };
  nameHref: string;
  /** The guest's Class (MESITA-4639): Regular or VIP, computed by the server. */
  guestClass?: GuestClass;
  /** "Public", "Private" or "Privacy unknown" for a linked Instagram; null
   *  when none is linked (MESITA-4639). */
  privacy?: string | null;
}) {
  const [handle, followers] = splitInstagramLabel(instagram.label);
  const facts = [followers, privacy].filter(Boolean).join(" · ");
  // NAME LEFT, CLASS RIGHT, INSTAGRAM BUTTON (Pato, 2026-11-22, MESITA-4639:
  // "Name left, Class right, INSTAGRAM BUTTON. Class is regular class and vip
  // class"). The 72px photo stays centred; under it the name pill with the
  // Class chip at its right (Regular grey, VIP ink with a crown), then the
  // full-width Instagram pill: "@handle (2,026 followers · Public)". The 1K+
  // crown tag (MESITA-4370) is gone: the Class chip says VIP. MESITA-4543
  // had no Class.
  const vip = guestClass === "vip";
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-3 text-center" data-identity-card>
      <span className={IDENTITY_RING_CLASS} aria-hidden>
        <span className="bg-muted relative block h-[72px] w-[72px] overflow-hidden rounded-full">
          {avatarUrl ? (
            <SizedImg src={avatarUrl} size="thumb" alt="" className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar className="h-full w-full" />
          )}
        </span>
      </span>
      <span className="flex w-full min-w-0 flex-col gap-2">
        <span className="flex w-full min-w-0 items-center gap-2">
          <PushLink
            href={nameHref}
            aria-label={`Profile: ${name}`}
            className={cn(IDENTITY_PILL_CLASS, "flex-1 justify-start")}
            data-identity-name
          >
            <User className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="truncate">{name}</span>
          </PushLink>
          <span
            className={cn(
              "flex h-12 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
              vip ? "border-neutral-950 bg-neutral-950 text-white" : "border-border bg-muted text-muted-foreground",
            )}
            aria-label={`Class: ${CLASS_LABEL[guestClass]}`}
            data-identity-class={guestClass}
          >
            {vip && <Crown className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
            {CLASS_LABEL[guestClass]}
          </span>
        </span>
        <PushLink
          href={instagram.href}
          aria-label={instagram.label.startsWith("@") ? `Instagram: ${instagram.label}${privacy ? ` · ${privacy}` : ""}` : instagram.label}
          className={IDENTITY_PILL_CLASS}
          data-identity-instagram
        >
          <InstagramBadge connected={instagram.connected} />
          <span className="truncate">{facts ? `${handle} (${facts})` : handle}</span>
        </PushLink>
      </span>
    </div>
  );
}
