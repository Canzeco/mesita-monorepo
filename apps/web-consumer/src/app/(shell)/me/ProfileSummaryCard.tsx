"use client";

import Image from "next/image";
import { Instagram, Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  CLASSES,
  CLASS_MARK_ICON,
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
  formatPhoneDisplay,
  formatSex,
  phoneCountry,
} from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2) ─────────────────────────────────────────
//
//   header      brand lockup + the profile's privacy state
//   identity    photo ringed in the class metal · name · age·sex·country·phone
//   three tiles INSTAGRAM · CLASS · PLAN — the three things a guest holds
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag.
//
// The class and plan axes are NEVER merged: the class tile can't show Premium
// and the plan tile can't show a metal. Each tile taps through to the surface
// that owns it, which is why the card carries no separate CTA.

/** Each metal's fill for the class tile and the avatar ring. */
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
        "flex min-w-0 flex-col items-start rounded-2xl p-2.5 text-left shadow-sm transition active:scale-[0.98]",
        held ? cn(fill, "text-white") : "border-border bg-card border",
      )}
    >
      <span
        className={cn(
          "flex max-w-full items-center gap-1 text-[9px] font-bold tracking-[0.1em] uppercase",
          held ? "text-white/85" : "text-muted-foreground",
        )}
      >
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{eyebrow}</span>
      </span>
      <span className="font-display mt-1.5 w-full truncate text-[16px] leading-tight font-semibold tracking-tight">
        {value}
      </span>
      <span
        className={cn(
          "mt-1 w-full text-[10px] leading-snug",
          held ? "text-white/85" : "text-muted-foreground",
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
        className="border-border bg-card w-full overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="bg-muted h-1.5 w-full" />
        <div className="flex flex-col gap-4 p-4">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="flex items-center gap-3.5">
            <div className="bg-muted h-16 w-16 animate-pulse rounded-full" />
            <div className="flex flex-col gap-2">
              <div className="bg-muted h-5 w-40 animate-pulse rounded" />
              <div className="bg-muted h-3 w-32 animate-pulse rounded" />
              <div className="bg-muted h-3 w-28 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted h-[84px] animate-pulse rounded-2xl" />
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
  const isPublic = profile?.profile_public ?? false;

  // age · sex · country — country inferred from the dial code the guest
  // already gave us at onboarding.
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const country = phoneCountry(profile?.phone);
  const phone = formatPhoneDisplay(profile?.phone);
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
      className="border-border bg-card w-full overflow-hidden rounded-2xl border shadow-sm"
    >
      {/* The metal band — the class is the first thing the card says. */}
      <div className={cn("h-1.5 w-full", CLASS_FILL[key])} />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <MesitaLogo className="text-primary h-[18px] w-auto" />
          <span
            className={cn(
              "border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold tracking-[0.12em] uppercase",
              isPublic && "text-foreground/70",
            )}
          >
            {isPublic ? (
              <Unlock className="h-2.5 w-2.5" />
            ) : (
              <Lock className="h-2.5 w-2.5" />
            )}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>

        <div className="flex items-center gap-3.5">
          <div
            className={cn("shrink-0 rounded-full p-[2.5px]", CLASS_FILL[key])}
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

          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display truncate text-[22px] leading-tight font-semibold tracking-tight">
              {name}
            </h2>
            {detailLine && (
              <p className="text-muted-foreground truncate text-[12px]">
                {detailLine}
              </p>
            )}
            {phone && (
              <p className="text-muted-foreground truncate text-[12px] tabular-nums">
                {phone}
              </p>
            )}
          </div>
        </div>

        {/* The three things a guest holds. Each taps into the surface that
            owns it — Instagram verify, the Class sheet, Stripe. */}
        <div className="grid grid-cols-3 items-stretch gap-1.5">
          <Tile
            eyebrow="Instagram"
            Icon={Instagram}
            value={igConnected ? (handle ? `@${handle}` : "Connected") : "None"}
            note={
              igConnected
                ? `${formatCompactCount(followers)} followers`
                : "Connect to climb"
            }
            fill={INSTAGRAM_BADGE_GRADIENT_CLASS}
            held={igConnected}
            onClick={onOpenInstagram}
          />
          <Tile
            eyebrow="Class"
            Icon={ClassIcon}
            value={classLabel}
            note="Earned, not bought"
            fill={CLASS_FILL[key]}
            held
            onClick={onOpenClass}
          />
          <Tile
            eyebrow="Plan"
            Icon={PREMIUM_PLAN_ICON}
            value={planLabel}
            note={planNote}
            fill="bg-pink-gradient"
            held={isPremium}
            onClick={onOpenPlan}
          />
        </div>
      </div>
    </section>
  );
}
