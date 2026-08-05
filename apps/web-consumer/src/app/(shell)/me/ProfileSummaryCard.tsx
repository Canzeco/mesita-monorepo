"use client";

import Image from "next/image";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CLASSES, isElevatedClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatPhoneDisplay,
  formatSex,
} from "@/lib/utils";

// ─── Simple ID-1 membership card (MESITA-918) ───────────────────────────────
// ISO 7810 credit-card ratio. Face + name + class · whisper · phone · one
// footer line. No metric columns, no chip/foil chrome.

function ClassChip({
  label,
  classKey,
}: {
  label: string;
  classKey: string;
}) {
  const chipClass =
    classKey === "aura"
      ? "border-amber-400/40 bg-gradient-to-br from-amber-200/50 to-orange-200/35 text-amber-900"
      : classKey === "influencer"
        ? "border-sky-400/40 bg-gradient-to-br from-sky-200/45 to-sky-300/30 text-sky-900"
        : classKey === "premium"
          ? "border-violet-400/40 bg-gradient-to-br from-violet-200/45 to-fuchsia-200/30 text-violet-900"
          : "border-primary/25 bg-gradient-to-br from-primary/15 to-secondary/20 text-primary";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] uppercase",
        chipClass,
      )}
    >
      {label}
    </span>
  );
}

export function ProfileSummaryCard({
  profile,
  visits,
  loading,
}: {
  profile: ConsumerProfile | null;
  visits: number | null;
  loading: boolean;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  const elevatedBg =
    key === "aura"
      ? "bg-tier-gold"
      : key === "influencer"
        ? "bg-sky-600"
        : "bg-tier-premium";

  if (loading) {
    return (
      <div className="border-border bg-muted/50 aspect-[1.586/1] w-full overflow-hidden rounded-2xl border px-4 py-3">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
            <div className="bg-muted h-5 w-14 animate-pulse rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-muted h-14 w-14 shrink-0 animate-pulse rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-muted h-5 w-36 animate-pulse rounded" />
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-3 w-28 animate-pulse rounded" />
            </div>
          </div>
          <div className="bg-muted h-3 w-40 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const first = profile?.first_name ?? "";
  const last = profile?.last_name ?? "";
  const name =
    [first, last].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const phone = formatPhoneDisplay(profile?.phone);
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Standard";
  const handle = profile?.instagram_handle ?? classHandle;
  const igConnected = origin === "instagram" || Boolean(handle);
  const whisper = [sexLabel, age != null ? String(age) : null]
    .filter(Boolean)
    .join(" · ");
  const footerLeft = igConnected
    ? [handle ? `@${handle}` : "Connected", formatCompactCount(followers)]
        .filter(Boolean)
        .join(" · ")
    : "Instagram not connected";

  return (
    <section
      aria-label="Your Mesita membership card"
      className={cn(
        "border-border aspect-[1.586/1] w-full overflow-hidden rounded-2xl border px-4 py-3",
        isElevated
          ? "from-primary/[0.14] via-secondary/[0.08] to-accent/[0.10] bg-gradient-to-br"
          : "from-primary/[0.10] via-secondary/[0.06] to-accent/[0.07] bg-gradient-to-br",
      )}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-foreground/35 text-[10px] font-bold tracking-[0.28em] uppercase select-none">
            Mesita
          </span>
          <ClassChip label={classLabel} classKey={key} />
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={cn(
                "rounded-full p-[2px]",
                isElevated ? elevatedBg : "bg-pink-gradient",
              )}
            >
              <div className="bg-card rounded-full p-[2px]">
                <div className="bg-muted relative h-14 w-14 overflow-hidden rounded-full">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="h-full w-full" />
                  )}
                </div>
              </div>
            </div>
            {/* IG photo badge — same avatar + IG ring until a dedicated IG URL exists */}
            <div
              className={cn(
                "absolute -right-0.5 -bottom-0.5 rounded-full p-[1.5px]",
                igConnected
                  ? "bg-[linear-gradient(135deg,#f58529,#dd2a7b_45%,#8134af)]"
                  : "bg-border",
              )}
              aria-hidden
            >
              <div className="bg-card h-5 w-5 overflow-hidden rounded-full">
                {igConnected && avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={20}
                    height={20}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="bg-muted h-full w-full" />
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-[18px] leading-tight font-bold tracking-tight">
              {name}
            </h2>
            {whisper ? (
              <p className="text-muted-foreground mt-1 truncate text-[12px] font-medium">
                {whisper}
              </p>
            ) : null}
            {phone ? (
              <p className="text-foreground/70 mt-1 truncate font-mono text-[12px] font-semibold tracking-wide tabular-nums">
                {phone}
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground flex items-baseline justify-between gap-3 text-[12px] font-semibold">
          <span
            className={cn(
              "min-w-0 truncate",
              igConnected ? "text-secondary" : "text-muted-foreground/70",
            )}
          >
            {footerLeft}
          </span>
          <span className="shrink-0 tabular-nums">
            Visits {visits ?? "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
