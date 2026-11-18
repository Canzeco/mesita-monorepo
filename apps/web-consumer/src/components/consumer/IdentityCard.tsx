"use client";

import { Fragment, type ReactNode } from "react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { UserRound } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  IDENTITY_BOXES,
  IDENTITY_BOX_SPAN,
  IDENTITY_CARD_CLASS,
  IDENTITY_CHIP_CLASS,
  IDENTITY_GRID_CLASS,
  IDENTITY_PHOTO_CLASS,
  IDENTITY_RING_CLASS,
  type IdentityBox,
} from "./identity-card-layout";

// ONE IDENTITY CARD (Pato, MESITA-2547: "that card at the top is the card.
// the card must display all public info from instagram to profile picture
// to name"). Me's header draws it for the guest (Instagram is a door there);
// Social's person card draws it for a member (Instagram is a fact: the full
// handle, MESITA-2590, or "die***" until the viewer shows their own,
// MESITA-2594). Never the phone: it is private and
// lives in Settings.
//
// CENTRED, TWO BOXES, EACH A WHOLE ROW:
//
//                  (64px photo)
//   ( 👤 Diego                                 )
//   ( ◎ @diego (~1.2K followers)               )
//
// NO CLASS (MESITA-4306, Pato, 2026-11-17: "LETS REMOVE THE CLASS. MAYBE WE
// CAN RETURN THEM IN THE FUTURE"): VIP brought nothing since MESITA-4249,
// and the Instagram box already says the follower count. No Plan either
// (MESITA-3830); it is the Plan tile on Me's grid. History: four boxes
// (MESITA-2595), name and Instagram (MESITA-3830), name · Class · Instagram
// (MESITA-3833), name and Instagram again.
//
// 36px tall (MESITA-2599) and ONE text style, 14px semibold, in every box.
// No chevrons (Pato, MESITA-2604): a door on Me is still a link, it just
// does not draw an arrow.

// THE BOXES' GEOMETRY IS identity-card-layout.ts's: the ring, the photo, the
// grid, the 36px box and the row order. Me's loading skeleton
// reads the same module, so it is this card's boxes, empty (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").
const CHIP_CLASS = IDENTITY_CHIP_CLASS;

/** Grows a box's tap area to the 44px floor without growing it visually
 *  (MESITA-1688). */
const TAP_TARGET_CLASS =
  "after:absolute after:inset-x-0 after:inset-y-[-4px] after:content-['']";

export type IdentityInstagram = {
  /** Me: "@handle (~25K followers)" or "Connect Instagram"
   *  (MESITA-2606, MESITA-2696); Social: "@per*** (~1.2K followers)"
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

/** The name box: a link on Me (opens Me › Profile), a fact on Social. */
function NameBox({ name, href }: { name: string; href?: string }) {
  const className = cn(
    CHIP_CLASS,
    IDENTITY_BOX_SPAN.name,
    href && cn(TAP_TARGET_CLASS, "hover:bg-muted transition"),
  );
  const body = (
    <>
      <UserRound className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{name}</span>
    </>
  );
  return href ? (
    <PushLink
      href={href}
      aria-label={`Profile: ${name}`}
      className={className}
      data-identity-name
    >
      {body}
    </PushLink>
  ) : (
    <span className={className} data-identity-name>
      {body}
    </span>
  );
}

/** The Instagram box: a link on Me (opens /me/instagram), a fact on
 *  Social. */
function InstagramBox({ instagram }: { instagram: IdentityInstagram }) {
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
        CHIP_CLASS,
        IDENTITY_BOX_SPAN.instagram,
        TAP_TARGET_CLASS,
        "hover:bg-muted transition",
      )}
      data-identity-instagram
    >
      <InstagramBadge connected={instagram.connected} />
      <span className="truncate">{instagram.label}</span>
    </PushLink>
  ) : (
    <span
      className={cn(CHIP_CLASS, IDENTITY_BOX_SPAN.instagram)}
      data-identity-instagram
    >
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
  /** Me only: the name box opens Me › Profile. */
  nameHref?: string;
}) {
  // Every box, keyed as identity-card-layout.ts orders them; a null one
  // (no Instagram) is simply not drawn.
  const boxes: Record<IdentityBox, ReactNode> = {
    name: <NameBox name={name} href={nameHref} />,
    instagram: instagram && <InstagramBox instagram={instagram} />,
  };
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

      {/* Two rows: name, then Instagram (MESITA-4306). */}
      <div className={IDENTITY_GRID_CLASS} data-identity-chips>
        {IDENTITY_BOXES.map((box) => (
          <Fragment key={box}>{boxes[box]}</Fragment>
        ))}
      </div>
    </div>
  );
}
