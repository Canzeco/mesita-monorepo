"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { Crown, UserRound } from "lucide-react";
import { useConsumerIdentity } from "@/lib/identity-context";
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

/** One module: a 1px hairline box on the card's white. */
const MODULE_CLASS =
  "border-border flex min-w-0 items-center rounded-lg border px-3 transition-colors hover:bg-muted/60";

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
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram & { href: string };
  nameHref: string;
}) {
  const [handle, followers] = splitInstagramLabel(instagram.label);
  // Over the bar (1,000+ followers, igReach) a black crown tag after the
  // count (Pato, MESITA-4370: "a tag saying more than +1000 followers …
  // maybe a crown"). Not a Class: Class left Me in MESITA-4306.
  const { igReach } = useConsumerIdentity();
  // ONE UNIT, TWO UNITS (Pato, 2026-11-18, MESITA-4370: "name 1 unit tall
  // and instagram 2 units tall"): a 36px name box over a 72px Instagram box
  // holding the handle over its followers; the photo spans both, 116px.
  // THE GRID (Pato, 2026-11-18, MESITA-4340: "photo name / photo instagram.
  // name and instagram same height. photo double height"): the photo spans
  // both rows, 48 + 8 + 48 = 104px; the two boxes beside it are 48px each.
  // The "Name" label of MESITA-4335 is gone: the name says itself.
  return (
    <div
      className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[2.25rem_4.5rem] gap-x-3 gap-y-2"
      data-identity-card
    >
      <span className={cn(IDENTITY_RING_CLASS, "row-span-2 self-center")} aria-hidden>
        <span className="bg-muted relative block h-[113px] w-[113px] overflow-hidden rounded-full">
          {avatarUrl ? (
            <SizedImg src={avatarUrl} size="thumb" alt="" className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar className="h-full w-full" />
          )}
        </span>
      </span>
      <PushLink
        href={nameHref}
        aria-label={`Profile: ${name}`}
        className={cn(MODULE_CLASS, "h-9 gap-2")}
        data-identity-name
      >
        {/* A person before the name (Pato, 2026-11-18, MESITA-4354: "add an
            icon for the name … like a person"), the Instagram badge's size
            and place, so the two boxes line up. */}
        <span
          aria-hidden
          className="bg-muted text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        >
          <UserRound className="h-3 w-3" strokeWidth={2.5} />
        </span>
        {/* ONE TYPE (Pato, 2026-11-18, MESITA-4348: "keep fonts
            standardized"): the name and the handle are the Me tiles' own
            text-sm bold; the followers the same size, muted. */}
        <span className="text-foreground truncate text-sm font-bold tracking-tight">{name}</span>
      </PushLink>
      <PushLink
        href={instagram.href}
        aria-label={instagram.label.startsWith("@") ? `Instagram: ${instagram.label}` : instagram.label}
        className={cn(MODULE_CLASS, "h-[4.5rem] gap-2 text-sm")}
        data-identity-instagram
      >
        <InstagramBadge connected={instagram.connected} />
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground truncate font-bold tracking-tight">{handle}</span>
          {followers ? (
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <span className="truncate">{followers}</span>
              {igReach && (
                <span
                  className="type-meta flex shrink-0 items-center gap-1 rounded-full bg-neutral-950 px-2 py-0.5 font-bold text-white"
                  aria-label="Over 1,000 followers"
                  data-identity-reach
                >
                  <Crown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  1K+
                </span>
              )}
            </span>
          ) : null}
        </span>
      </PushLink>
    </div>
  );
}
