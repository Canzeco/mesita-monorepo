"use client";

import { useState } from "react";

import type { ConsumerProfile } from "@/lib/api/profile";
import { IdentityCard } from "@/components/consumer/IdentityCard";
import { ClassSheet } from "@/components/consumer/me/ClassSheet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toGuestClass, toGuestPlan, toVipDetails } from "@/lib/guest-standing";
import {
  IDENTITY_BAR_BODY_CLASS,
  IDENTITY_BAR_CLASS,
  IdentityCardSkeleton,
} from "./me-skeletons";

// ─── The identity header (MESITA-1079 v2 · -1619 · -1633 ·
//     -1636 · -1640 · -1646 · -1649 · -1650 · -1652 · -2040 · -2087) ───────
//
// AN APP BAR, NOT A CARD (Pato, MESITA-2582: "this must feel more like a
// header"; he picked "A · App bar" from a board of three on the real grid).
// Full width, white, a hairline under it — Instagram's own header — and
// fixed when the grid scrolls. Its content sits on the tiles' 16px edge, so
// it lines up with the grid (MESITA-2577 asked for that and made it an inset
// card; that read as one more tile).
//
//                     (photo)
//   ( 👤 name                                    )
//   ( ◎ Insta: @handle · 1.2K followers          )
//   ( ♛ Regular Class   ) ( ▭ Free Plan         )   the pair (MESITA-2614)
//   ─────── hairline ─────── full-width white bar; content on the 16px edge
//
// The card itself is IdentityCard, the same one Social shows for a member
// (MESITA-2547). NO PHONE: it is private (Pato, MESITA-2547: "that is super
// private. remove it from there"); it lives in Settings › Your account.
//
// The header is neutral for every guest: white, and the ring and the hairline
// are plain structure — a frame around the photo and a rule under the
// header — not a colour that means something.
//
// FIXED BY FLEX, NOT BY `sticky`. Me renders `flex h-full flex-col` around a
// `flex-1 overflow-y-auto px-4` scroller. This bar is a `shrink-0` SIBLING
// above that scroller, so it never moves, takes the same px-4 as the grid, and
// never fights the scroller's own gutter or z-index. `ModeTabs` uses
// `sticky top-0` because it lives INSIDE its scroller; this one does not have
// to.
//
// WHAT IS NOT HERE, and why. The card was 235px; permanent chrome on a
// scrolling grid cannot cost a third of a phone viewport, so two things do
// not fit:
//
//   an eyebrow            a header that names itself in a strip is spending
//                         the page on a label
//   age · sex · country   Profile owns name, photo, birthday
//
// Neither is lost: the eyebrow said nothing, and Profile prints the rest.
//
// THE BAR IS THE DOOR (gate decision, Pato, MESITA-1652). This reversed
// MESITA-1646's "the card displays and does nothing", because Instagram is
// the only connect door in the app. The Instagram cell on the grid below is a
// second path to the same page, and the chip stays anyway: a fixed bar is one
// tap from anywhere and a cell has to be scrolled to.

export function IdentityBar({
  profile,
  loading,
  instagramLabel,
  instagramConnected,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** "Insta: @handle · 25K followers", "Connect Instagram", … (MESITA-2606,
   *  MESITA-2696). */
  instagramLabel: string;
  /** False draws the plain glyph (MESITA-2696). */
  instagramConnected: boolean;
}) {
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  const guestClass = profile ? toGuestClass(profile.guest_class) : null;
  const plan = profile ? toGuestPlan(profile.plan) : null;
  const [classOpen, setClassOpen] = useState(false);

  return (
    <header
      aria-label="Your Mesita identity"
      aria-busy={loading || undefined}
      // THE APP BAR (MESITA-2582): full-width paper, a hairline under it,
      // no radius, no shadow. px-4 puts the photo's left edge and the chips
      // on the tiles' own 16px edge. Still short (MESITA-2574).
      className={IDENTITY_BAR_CLASS}
    >
      <div className={IDENTITY_BAR_BODY_CLASS} data-identity-app-bar>
        {loading ? (
          // The skeleton mirrors the DESTINATION (Docs › Design §D): the
          // 64px photo in its real ring, then the name, the Class · Plan
          // pair and Instagram (MESITA-2614, MESITA-2621). /me's loading.tsx
          // draws the same one, so the route fallback and this hand over
          // without a jump (Pato, MESITA-2701: "the placeholders must be
          // similar to the page you are loading, like the sizes").
          <IdentityCardSkeleton />
        ) : (
          <IdentityCard
            name={name}
            avatarUrl={avatarUrl}
            instagram={{
              label: instagramLabel,
              connected: instagramConnected,
              href: CONSUMER_ROUTES.mePages.instagram,
            }}
            // No profile (the read failed) hides Class and Plan: never a
            // guessed "Regular" or "Free" (MESITA-2553). Both are doors on Me;
            // Plan is back on the card (MESITA-2595).
            guestClass={guestClass}
            onClassPress={guestClass ? () => setClassOpen(true) : undefined}
            plan={plan}
            planHref={CONSUMER_ROUTES.mePages.plan}
            // The name box opens Me › Profile, where the name is edited
            // (MESITA-2596).
            nameHref={CONSUMER_ROUTES.mePages.profile}
          />
        )}
      </div>

      {guestClass && (
        <ClassSheet
          open={classOpen}
          onClose={() => setClassOpen(false)}
          guestClass={guestClass}
          vip={toVipDetails(
            guestClass,
            profile?.vip_partner,
            profile?.vip_until,
          )}
        />
      )}
    </header>
  );
}
