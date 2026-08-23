"use client";

import Image from "next/image";
import { Instagram, Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  CLASSES,
  CLASS_MARK_ICON,
  classBadgeClass,
  PLANS,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
  type ClassKey,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { INSTAGRAM_BADGE_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatSex,
  phoneCountry,
} from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2) ─────────────────────────────────────────
//
//   identity    photo ringed in the class metal · name · age·sex·country,
//               with the privacy state as a quiet marker on the right
//   three tiles INSTAGRAM · CLASS · PLAN — the three things a guest holds
//
// TWO ZONES, NOT THREE (MESITA-1158). There was a third row above these: the
// Mesita wordmark beside a bordered PUBLIC pill. Both lost their argument. The
// wordmark told a Mesita user they were inside Mesita, and the pill was drawn
// as a control while being a read-only status — a bordered rounded-full pill
// is the app's own button shape. `justify-between` across two light elements
// also left a wide dead gap over the card.
//
// The PHONE line is gone too. It was the third of three grey lines, the most
// private thing on the most glanceable surface, and the Profile BoxRow below
// this card already summarises as `name · phone` — so it is one tap away in
// the place that owns editing it. Age, sex and country stay: unlike the phone
// they appear nowhere else, and they collapse to ONE line, which is what fixes
// the block. The bug was never that the facts existed; it was three lines of
// identical 12px muted type stacked 2px apart, so nothing led.
//
// Gaps encode grouping rather than being uniform: 4px inside the name stack,
// 16px photo-to-name, 20px between the identity zone and the tiles. The card
// runs on one 4px scale (4·8·12·16·20); it previously mixed 2, 2.5, 6 and 14.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.
//
// The class and plan axes are NEVER merged: the class tile can't show Premium
// and the plan tile can't show a metal. Each tile taps through to the surface
// that owns it, which is why the card carries no separate CTA.

/** Each metal's fill for the avatar ring, where nothing sits on top of it.
 *  The class TILE takes `classBadgeClass` instead — a tile carries a label,
 *  so it needs the ink that goes with the metal, not just the metal. */
const CLASS_FILL: Record<ClassKey, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};

/**
 * One of the three passport tiles. `fill` paints it when the guest HOLDS the
 * thing; the empty state stays a bordered card so the card never reads as
 * three equally-earned badges.
 *
 * THE NOTE WRAPS, IT DOES NOT TRUNCATE. Three tiles across a 375px phone leaves
 * roughly 80px of text width each (343 content − 32 card padding − 12 gutters,
 * ÷ 3, − 20 tile padding), which fits about 13 characters at 10px. Every note
 * longer than that — "Earned, not bought", "Connect to climb" — is WIDER than
 * the tile can ever be, so `truncate` here clipped copy on every render rather
 * than in an edge case. Wrapping costs nothing: the grid row stretches and all
 * three tiles keep equal height. The VALUE still truncates, because a long
 * Instagram handle has no good second line.
 */
function Tile({
  eyebrow,
  Icon,
  value,
  note,
  fill,
  held,
  onClick,
}: {
  eyebrow: string;
  Icon: React.ComponentType<{ className?: string }>;
  value: string;
  note: string;
  fill: string;
  held: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${eyebrow}: ${value}. ${note}`}
      className={cn(
        "shadow-rest flex min-w-0 flex-col items-start rounded-2xl p-3 text-left transition active:scale-[0.98]",
        // `fill` carries its own ink — three of the four metals are LIGHT
        // fills and white on them measures under 2:1 (MESITA-1142), so the
        // tile cannot assume a colour here. Sub-text dims the inherited ink
        // instead of hardcoding a white wash.
        held ? fill : "border-border bg-card border",
      )}
    >
      <span
        className={cn(
          // 10px, not 9px: Docs › Design §D puts eyebrow/meta at
          // type-meta–xs, and 9px at this tracking was under its own floor.
          "type-meta flex max-w-full items-center gap-1 font-bold tracking-[0.12em] uppercase",
          held ? "opacity-85" : "text-muted-foreground",
        )}
      >
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{eyebrow}</span>
      </span>
      <span className="font-display mt-1.5 w-full truncate text-lg leading-tight font-semibold tracking-tight">
        {value}
      </span>
      <span
        className={cn(
          "type-meta mt-1 w-full leading-snug",
          held ? "opacity-85" : "text-muted-foreground",
        )}
      >
        {note}
      </span>
    </button>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenClass,
  onOpenPlan,
  onOpenInstagram,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenClass: () => void;
  onOpenPlan: () => void;
  onOpenInstagram: () => void;
}) {
  const {
    key,
    plan,
    origin,
    renewsAt,
    followers,
    handle: classHandle,
  } = useConsumerClass();

  if (loading) {
    return (
      <section
        aria-label="Your Mesita passport"
        aria-busy="true"
        className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
      >
        <div className="bg-muted h-1.5 w-full" />
        {/* The skeleton mirrors the DESTINATION (Docs › Design §D). It used
            to draw the old anatomy — a wordmark block and a three-line text
            stack — so the card visibly reshaped on every load. */}
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="bg-muted h-[65px] w-[65px] animate-pulse rounded-full" />
              <div className="flex flex-col gap-1">
                <div className="bg-muted h-5 w-40 animate-pulse rounded" />
                <div className="bg-muted h-3 w-32 animate-pulse rounded" />
              </div>
            </div>
            <div className="bg-muted h-2.5 w-14 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-[92px] animate-pulse rounded-2xl"
              />
            ))}
          </div>
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
  const ClassIcon = CLASS_MARK_ICON;

  const isPremium = plan === "premium";
  const planLabel = PLANS.find((p) => p.id === plan)?.label ?? "Free";
  // Renewal beats the flat price when we know it: "renews 1 Sep" answers the
  // question a paying guest actually has. Free states the price of the door.
  const renewalDate = renewsAt ? new Date(renewsAt) : null;
  const renewalValid =
    renewalDate != null && !Number.isNaN(renewalDate.valueOf());
  const planNote = isPremium
    ? renewalValid
      ? `Renews ${renewalDate.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        })}`
      : `MX$${PREMIUM_PLAN_PRICE_MXN}/mo`
    : `MX$${PREMIUM_PLAN_PRICE_MXN}/mo`;

  // Prefer the context handle so the Instagram preview state wins over a
  // stale profile row.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

  return (
    <section
      aria-label="Your Mesita passport"
      className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
    >
      {/* The metal band — the class is the first thing the card says. Hidden
          from assistive tech on purpose: it is colour-only, and the Class tile
          below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", CLASS_FILL[key])} aria-hidden />

      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn("shrink-0 rounded-full p-[2.5px]", CLASS_FILL[key])}
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
              <h2 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
                {name}
              </h2>
              {detailLine && (
                <p className="text-muted-foreground truncate text-xs">
                  {detailLine}
                </p>
              )}
            </div>
          </div>

          {/* Status, not control. The bordered rounded-full pill this replaces
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

        {/* The three things a guest holds. Each taps into the surface that
            owns it — Instagram verify, the Class sheet, Stripe. */}
        <div className="grid grid-cols-3 items-stretch gap-2">
          <Tile
            eyebrow="Instagram"
            Icon={Instagram}
            value={igConnected ? (handle ? `@${handle}` : "Connected") : "None"}
            note={
              igConnected
                ? `${formatCompactCount(followers)} followers`
                : "Connect to climb"
            }
            fill={cn(INSTAGRAM_BADGE_GRADIENT_CLASS, "text-white")}
            held={igConnected}
            onClick={onOpenInstagram}
          />
          <Tile
            eyebrow="Class"
            Icon={ClassIcon}
            value={classLabel}
            note="Earned, not bought"
            fill={classBadgeClass(key)}
            held
            onClick={onOpenClass}
          />
          <Tile
            eyebrow="Plan"
            Icon={PREMIUM_PLAN_ICON}
            value={planLabel}
            note={planNote}
            // The plan wears its OWN token, and that token is black
            // (decision: Pato, 2026-08-22). This was `bg-pink-gradient`,
            // which sat two tiles from Instagram's pink gradient — the two
            // axes read as one family, and pink here means Instagram.
            fill="bg-tier-premium text-white"
            held={isPremium}
            onClick={onOpenPlan}
          />
        </div>
      </div>
    </section>
  );
}
