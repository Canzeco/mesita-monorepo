"use client";

import Image from "next/image";
import { ChevronRight, Instagram, Lock, Ticket, Unlock, Zap } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  CLASSES,
  CLASS_ICONS,
  PLANS,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
  type ClassKey,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn, formatCompactCount } from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2 rebuild) ─────────────────────────────────
// Replaces the centred-photo + five-stacked-rows card. That layout gave every
// fact the same weight, so the two things a guest actually holds — the CLASS
// they earned and the PLAN they pay for — read no louder than their phone
// number. The v2 card is built around the two axes instead:
//
//   header      brand lockup + the privacy state of the profile
//   identity    photo ringed in the class metal · name · Instagram
//   two tiles   CLASS (metal fill) and PLAN (brand pink) side by side
//   aura list   the invitation-only routes into Diamond
//   stack CTA   into the Class sheet
//
// The axes are NEVER merged: the class tile can't show Premium and the plan
// tile can't show a metal. Phone / sex / age moved to Personal details, and
// visits / saved to the Metrics box — both already own that data.

/** Each metal's fill for the class tile and the avatar ring. */
const CLASS_FILL: Record<ClassKey, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};

// The routes onto the Aura list — the only doors into Diamond (CLASSES.diamond
// req: "Aura-list invitation"). Editorial, like the class ladder copy: nothing
// here grants anything, it tells a guest the rung exists and can't be bought.
const AURA_ROUTES = [
  { key: "press", label: "Aura · Press", detail: "Invitation-only" },
  { key: "mesita", label: "Invited by Mesita", detail: "Invitation-only" },
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
      {children}
    </p>
  );
}

/** CLASS / PLAN tile — big value on a filled card, eyebrow above, note below. */
function AxisTile({
  eyebrow,
  Icon,
  value,
  note,
  fill,
  muted = false,
}: {
  eyebrow: string;
  Icon: React.ComponentType<{ className?: string }>;
  value: string;
  note: string;
  fill: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-2xl p-3.5 shadow-sm",
        muted ? "border-border border bg-card" : cn(fill, "text-white"),
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase",
          muted ? "text-muted-foreground" : "text-white/85",
        )}
      >
        <Icon className="h-3 w-3" />
        {eyebrow}
      </span>
      <span className="font-display mt-2 truncate text-[26px] leading-none font-semibold tracking-tight">
        {value}
      </span>
      <span
        className={cn(
          "mt-1.5 truncate text-[11px]",
          muted ? "text-muted-foreground" : "text-white/85",
        )}
      >
        {note}
      </span>
    </div>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenClass,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenClass: () => void;
}) {
  const {
    key,
    plan,
    origin,
    renewsAt,
    followers,
    handle: classHandle,
    doors,
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
              <div className="bg-muted h-4 w-40 animate-pulse rounded" />
              <div className="bg-muted h-5 w-28 animate-pulse rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-muted h-[104px] animate-pulse rounded-2xl" />
            <div className="bg-muted h-[104px] animate-pulse rounded-2xl" />
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

  const cls = CLASSES.find((c) => c.id === key);
  const classLabel = cls?.label ?? "Bronze";
  const ClassIcon = CLASS_ICONS[key];

  const isPremium = plan === "premium";
  const planLabel = PLANS.find((p) => p.id === plan)?.label ?? "Free";
  // Renewal beats the flat price when we know it: "renews 1 Sep" answers the
  // question a paying guest actually has. Free states the price of the door.
  const renewalDate = renewsAt ? new Date(renewsAt) : null;
  const renewalValid = renewalDate != null && !Number.isNaN(renewalDate.valueOf());
  const planNote = isPremium
    ? renewalValid
      ? `Renews ${renewalDate.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`
      : `MX$${PREMIUM_PLAN_PRICE_MXN}/mo`
    : `MX$${PREMIUM_PLAN_PRICE_MXN}/mo to upgrade`;

  // Prefer the context handle so the Instagram preview state wins over a
  // stale profile row.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);
  const igLabel = igConnected
    ? [handle ? `@${handle}` : "Connected", formatCompactCount(followers)]
        .filter(Boolean)
        .join(" · ")
    : "Instagram not connected";

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
          <div className={cn("shrink-0 rounded-full p-[2.5px]", CLASS_FILL[key])}>
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

          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <h2 className="font-display w-full truncate text-[22px] leading-tight font-semibold tracking-tight">
              {name}
            </h2>
            <span
              className={cn(
                "border-border inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                igConnected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Instagram
                className={cn(
                  "h-3 w-3 shrink-0",
                  igConnected ? "text-secondary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{igLabel}</span>
            </span>
          </div>
        </div>

        {/* The two axes, side by side and equally weighted. */}
        <div className="grid grid-cols-2 gap-2.5">
          <AxisTile
            eyebrow="Class"
            Icon={ClassIcon}
            value={classLabel}
            note="Earned, not bought"
            fill={CLASS_FILL[key]}
          />
          <AxisTile
            eyebrow="Plan"
            Icon={PREMIUM_PLAN_ICON}
            value={planLabel}
            note={planNote}
            fill="bg-pink-gradient"
            muted={!isPremium}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Eyebrow>Aura list</Eyebrow>
          {AURA_ROUTES.map((route) => (
            <div
              key={route.key}
              className="border-border flex items-center gap-3 rounded-2xl border p-3"
            >
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Ticket className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground block truncate text-[11px]">
                  {route.label}
                </span>
                <span className="block truncate text-[13px] font-bold tracking-tight">
                  {doors.invitation ? "Invitation held" : route.detail}
                </span>
              </span>
              <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-1 text-[10px] font-bold">
                Diamond
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenClass}
          className="bg-primary/5 hover:bg-primary/10 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]"
        >
          <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <Zap className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-bold tracking-tight">
            Stack them all for the biggest reward
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>
      </div>
    </section>
  );
}
