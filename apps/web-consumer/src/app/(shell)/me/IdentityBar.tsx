"use client";

import { useState } from "react";

import type { ConsumerProfile } from "@/lib/api/profile";
import { IdentityCard } from "@/components/consumer/IdentityCard";
import { ClassSheet } from "@/components/consumer/me/ClassSheet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";

// ─── The identity header (MESITA-1079 v2 · -1619 · -1633 ·
//     -1636 · -1640 · -1646 · -1649 · -1650 · -1652 · -2040 · -2087) ───────
//
// IT IS NOT A CARD (Pato, MESITA-1652): "this must be a header, top menu
// style, occupying the full width and fixed when scrolling. it must contain
// the photo, name, insta."
//
//   (photo)  name
//   (photo)  [instagram]
//   (photo)  [Class ›] [Plan ›]    (MESITA-2553: two separate facts)
//   ─────── band ───────
//
// The card itself is IdentityCard, the same one Social shows for a member
// (MESITA-2547). NO PHONE: it is private (Pato, MESITA-2547: "that is super
// private. remove it from there"); it lives in Settings › Your account.
//
// ONE FACT IN THE HEADER: Instagram. The header is neutral for every guest,
// and the ring and the band are plain structure — a frame around the photo
// and a rule under the header — not a colour that means something.
//
// FIXED BY FLEX, NOT BY `sticky`. Me renders `flex h-full flex-col` around a
// `flex-1 overflow-y-auto px-4` scroller. This bar is a `shrink-0` SIBLING
// above that scroller, so it never moves, spans the full width for free, and
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
  instagramSummary,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** "@handle", "Connected", or "Connect it". */
  instagramSummary: string;
}) {
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  const standing = profile
    ? { guestClass: toGuestClass(profile.guest_class), plan: toGuestPlan(profile.plan) }
    : null;
  const [classOpen, setClassOpen] = useState(false);

  return (
    <header
      aria-label="Your Mesita identity"
      aria-busy={loading || undefined}
      className="border-border bg-background/95 relative shrink-0 border-b backdrop-blur-xl"
    >
      <div className="relative flex flex-col items-center gap-3.5 px-4 py-4">
        {loading ? (
          <>
            {/* The skeleton mirrors the DESTINATION (Docs › Design §D): the
                87px ringed avatar on the left, and the name, Instagram and
                Class · Plan rows beside it (MESITA-2553). */}
            <div className="flex w-full items-center gap-4">
              <div className="bg-muted h-[87px] w-[87px] shrink-0 animate-pulse rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="bg-muted h-5 w-2/5 animate-pulse rounded-md" />
                <div className="bg-muted h-8 w-3/5 animate-pulse rounded-full" />
                <div className="bg-muted h-8 w-1/2 animate-pulse rounded-full" />
              </div>
            </div>
          </>
        ) : (
          <IdentityCard
            name={name}
            avatarUrl={avatarUrl}
            instagram={{
              label: instagramSummary,
              href: CONSUMER_ROUTES.mePages.instagram,
            }}
            // No profile (the read failed) hides the row: never a guessed
            // "Free" or "Regular" (MESITA-2553).
            standing={standing}
            onClassPress={standing ? () => setClassOpen(true) : undefined}
            planHref={CONSUMER_ROUTES.mePages.plan}
          />
        )}
      </div>

      {/* The band — a full-width rule that closes the header. Structure, not
          a signal; hidden from assistive tech because it says nothing. */}
      <div className="bg-border h-2.5 w-full" aria-hidden />
      {standing && (
        <ClassSheet
          open={classOpen}
          onClose={() => setClassOpen(false)}
          guestClass={standing.guestClass}
        />
      )}
    </header>
  );
}
