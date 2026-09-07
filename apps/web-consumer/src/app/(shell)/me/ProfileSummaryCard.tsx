"use client";

import Image from "next/image";
import { ChevronRight, Instagram, Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  CLASSES,
  classBadgeClass,
  classFillClass,
  REACH_ENTRY_CLASS,
  REACH_ENTRY_FOLLOWERS,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatSex,
  phoneCountry,
} from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2 · MESITA-1619) ───────────────────────────
//
//   identity    photo ringed in the class metal · name beside the CLASS CHIP ·
//               age·sex·country, with the privacy state as a quiet marker
//   one row     INSTAGRAM — the one door on this card the guest can still open
//
// NO PLAN TILE (decision: Pato, MESITA-1619). The Passport prints what is
// EARNED and PUBLIC. Class is earned and never purchasable; the plan is what
// you PAY, and money on an identity card is the retired v1 merge coming back
// in a new shape — Docs › Passport §B: "It never prints on the Passport."
// Plan keeps its own surface, a primary box on Me. Do not re-add it here; a
// second axis on this card is a product decision, not a layout one.
//
// WHY THE CLASS IS A CHIP AND NOT A TILE. It used to be one of three equal
// tiles, which meant the card said the class FIVE times — the metal band, the
// avatar ring, the tile fill, the word inside it, and Me's own Class box
// underneath, which says strictly more ("Diamond · Highest discount"). The
// tile was 83% of all the colour on a card whose one rule is that colour means
// class. As a chip the rung is still stated in words and still taps into the
// Class sheet, at a size proportionate to a fact the band already carries.
//
// THE BAND AND THE RING ARE `aria-hidden` — they are colour-only, and THE CHIP
// is what states the rung in words. Anything that moves the chip has to keep
// that true or both become screen-reader regressions.
//
// WHY INSTAGRAM IS A FULL ROW. It is the growth lever — the one door on this
// card that changes the guest's class — and at a third of the width it could
// not say so: the eyebrow itself truncated to "INSTAGR…" on a 375px phone, and
// the unconnected state was a bordered box the eye read as empty. A full row
// fits the whole invitation on one line, and it names the bar it derives from
// (`REACH_ENTRY_CLASS`) rather than a number typed into copy.
//
// COLOUR ON THE ROW IS THE GLYPH, NOT THE FILL. The row body is `bg-muted`.
// A full-width brand-pink field would out-colour the class band on a card
// whose whole rule is that colour means class, and the old tile paired the
// gradient with `text-white` — white measures 1.36:1 on its `#feda75` stop,
// the MESITA-1142 fill/ink failure never audited here because Instagram is not
// a metal. The gradient now lives on a 44px chip that carries no small text.
//
// TWO ZONES, NOT THREE (MESITA-1158). There was a third row above these: the
// Mesita wordmark beside a bordered PUBLIC pill. Both lost their argument. The
// wordmark told a Mesita user they were inside Mesita, and the pill was drawn
// as a control while being a read-only state.
//
// The PHONE line is gone too — the most private thing on the most glanceable
// surface, and the Profile box below already summarises as `name · phone`.
// Age, sex and country stay: they appear nowhere else, and they collapse to
// ONE line, which is what fixes the block.
//
// Gaps encode grouping rather than being uniform: 4px inside the name stack,
// 16px photo-to-name, 20px between the identity zone and the row.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

/**
 * The Instagram row's shell, shared by the live row and its skeleton.
 *
 * A CONSTANT, NOT TWO MATCHING LITERALS. The skeleton mirrors the
 * DESTINATION (Docs › Design §D), and the way that rule broke before was a
 * hand-tuned `h-[92px]` measured against a layout that had since changed —
 * two numbers guessed independently, drifting apart in silence. There is
 * nothing to keep in sync now: both branches render the same shell.
 */
const PASSPORT_ROW_CLASS =
  "flex min-h-[76px] w-full items-center gap-3.5 rounded-2xl p-3";

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenClass,
  onOpenInstagram,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenClass: () => void;
  onOpenInstagram: () => void;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();

  if (loading) {
    return (
      <section
        aria-label="Your Mesita passport"
        aria-busy="true"
        className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
      >
        <div className="bg-muted h-1.5 w-full" />
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* 69px, not 65: the real avatar is 60 + the 2.5px metal ring
                  + the 2px card inset, on both sides. */}
              <div className="bg-muted h-[69px] w-[69px] animate-pulse rounded-full" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-[25px] w-36 animate-pulse rounded" />
                  <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
                </div>
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              </div>
            </div>
            <div className="bg-muted mt-1 h-3.5 w-16 animate-pulse rounded" />
          </div>
          <div className={cn(PASSPORT_ROW_CLASS, "bg-muted animate-pulse")} />
        </div>
      </section>
    );
  }

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  const isPublic = profile?.privacy_public ?? false;

  // age · sex · country — country inferred from the dial code the guest
  // already gave us at onboarding.
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const country = phoneCountry(profile?.phone);
  const detailLine = [
    age != null ? `${age}` : null,
    sexLabel,
    country ? `${country.flag} ${country.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const cls = CLASSES.find((c) => c.id === key);
  const classLabel = cls?.label ?? "Bronze";

  // Prefer the context handle so the Instagram preview state wins over a
  // stale profile row.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);
  const igValue = igConnected
    ? handle
      ? `@${handle}`
      : "Connected"
    : // The sheet's own wording (MESITA-1619). "None" answered a question
      // nobody asked, and read badly aloud: "Instagram: None."
      "Not connected";
  const igNote = igConnected
    ? `${formatCompactCount(followers)} followers`
    : `Connect to climb — ${REACH_ENTRY_CLASS.label} at ${REACH_ENTRY_FOLLOWERS.toLocaleString()} followers`;

  return (
    <section
      aria-label="Your Mesita passport"
      className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
    >
      {/* The metal band — the class is the first thing the card says. Hidden
          from assistive tech on purpose: it is colour-only, and the class chip
          below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn(
                "shrink-0 rounded-full p-[2.5px]",
                classFillClass(key),
              )}
              aria-hidden
            >
              <div className="bg-card rounded-full p-[2px]">
                <div className="bg-muted relative h-[60px] w-[60px] overflow-hidden rounded-full">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={name}
                      fill
                      sizes="60px"
                      className="object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="h-full w-full" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
                  {name}
                </h2>
                {/* The rung, in words, tapping into the surface that owns it.
                    `cls?.reward` and not "Earned, not bought": the label has
                    to announce the account's STATE, and the slogan is the
                    same on every account at every rung, forever. It is also
                    what the Class box and the passport sheet already say. */}
                <button
                  type="button"
                  onClick={onOpenClass}
                  aria-label={`Class: ${classLabel}${
                    cls?.reward ? `. ${cls.reward}` : ""
                  }`}
                  className={cn(
                    "type-label shrink-0 rounded-full px-2 py-0.5 font-bold tracking-tight transition active:scale-[0.97]",
                    classBadgeClass(key),
                  )}
                >
                  {classLabel}
                </button>
              </div>
              {detailLine && (
                <p className="text-muted-foreground truncate text-xs">
                  {detailLine}
                </p>
              )}
            </div>
          </div>

          {/* State, not control. The bordered rounded-full pill this replaces
              wore the app's button shape while being unclickable. */}
          <span
            aria-label={`Profile is ${isPublic ? "public" : "private"}`}
            className="text-muted-foreground type-meta mt-1 inline-flex shrink-0 items-center gap-1 font-bold tracking-[0.12em] uppercase"
          >
            {isPublic ? (
              <Unlock className="h-2.5 w-2.5" />
            ) : (
              <Lock className="h-2.5 w-2.5" />
            )}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>

        {/* The one door. THE NOTE WRAPS, IT DOES NOT TRUNCATE: it is a
            sentence, and a clipped sentence is worse than a taller row. The
            unconnected copy is the longest string here and it still has to
            survive 320px and a 200% text zoom, both of which `type-meta`
            follows because it is defined in rem. */}
        <button
          type="button"
          onClick={onOpenInstagram}
          aria-label={`Instagram: ${igValue}. ${igNote}`}
          className={cn(
            PASSPORT_ROW_CLASS,
            "bg-muted shadow-rest text-left transition active:scale-[0.99]",
          )}
        >
          <span
            className={cn(
              INSTAGRAM_ICON_GRADIENT_CLASS,
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white",
            )}
            aria-hidden
          >
            <Instagram className="h-[22px] w-[22px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground type-meta block font-bold tracking-[0.12em] uppercase">
              Instagram
            </span>
            <span className="font-display mt-0.5 block truncate text-lg leading-tight font-semibold tracking-tight">
              {igValue}
            </span>
            <span className="text-muted-foreground type-meta mt-1 block leading-snug">
              {igNote}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>
      </div>
    </section>
  );
}
