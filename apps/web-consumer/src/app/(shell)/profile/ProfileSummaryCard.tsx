"use client";

import Image from "next/image";
import { BadgeCheck, Crown, Instagram } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { CLASSES } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  ageFromBirthday,
  cn,
  firstInitials,
  formatSex,
} from "@/lib/utils";

// ─── Profile summary (static, not clickable) ──────────────────────────────

export function ProfileSummaryCard({
  profile,
  loading,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();
  const isPremium = key === "premium";

  if (loading) {
    return (
      <div className="border-border bg-muted/50 overflow-hidden rounded-3xl border p-4">
        <div className="flex items-center gap-4">
          {/* Avatar: 76px to match the real story-ring avatar (66px + 2x2.5px rings). */}
          <div className="bg-muted h-[76px] w-[76px] shrink-0 animate-pulse rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="bg-muted h-5 w-40 animate-pulse rounded" />
            <div className="bg-muted h-3.5 w-28 animate-pulse rounded" />
            <div className="bg-muted h-3.5 w-20 animate-pulse rounded" />
          </div>
        </div>
        {/* Two identical icon-rows mirror the real Instagram + class rows so the
            placeholders share one size instead of two mismatched bars. */}
        <div className="border-border/60 mt-4 flex flex-col gap-2.5 border-t pt-3.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-muted h-7 w-7 shrink-0 animate-pulse rounded-lg" />
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="bg-muted h-7 w-7 shrink-0 animate-pulse rounded-lg" />
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
          </div>
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
  const initials = firstInitials(name);
  const avatarUrl = profile?.avatar_url ?? null;
  const phone = profile?.phone ?? null;

  // Sex + age on one line under the phone — country is intentionally omitted.
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const meta = [sexLabel, age != null ? `${age}` : null]
    .filter(Boolean)
    .join(" · ");

  // Every piece of the member's actual data lives here in the card — name,
  // phone, class, Instagram. The boxes below are pure action buttons and carry
  // no user data (so "why class?" is answered once, here).
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Free";
  const classVia = isPremium && origin !== "default" ? origin : null;
  // Real handle lives on the profile; fall back to the class-context handle
  // (carries the demo handle for the Instagram preview state).
  const handle = profile?.instagram_handle ?? classHandle;
  const igConnected = origin === "instagram" || Boolean(handle);

  return (
    // Branded tinted panel — a soft class-tinted gradient so the identity card
    // reads as premium and distinct from the white option boxes below (richer
    // for Premium).
    <section
      className={cn(
        "border-border overflow-hidden rounded-3xl border p-4",
        isPremium
          ? "from-primary/[0.14] via-secondary/[0.10] to-accent/[0.12] bg-gradient-to-br"
          : "from-primary/[0.08] via-secondary/[0.06] to-accent/[0.08] bg-gradient-to-br",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Story-ring avatar: class-tinted gradient ring around initials. */}
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isPremium ? "bg-tier-premium" : "bg-pink-gradient",
          )}
        >
          <div className="bg-card rounded-full p-[2.5px]">
            <div className="bg-muted relative flex h-[66px] w-[66px] items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  sizes="66px"
                  className="object-cover"
                />
              ) : (
                <span className="font-display text-foreground/70 text-2xl font-bold tracking-tight">
                  {initials}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Name over phone, stacked to the right of the avatar. */}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[20px] leading-tight font-bold tracking-tight">
            {name}
          </h2>
          <p
            className={cn(
              "mt-1 truncate text-[14px]",
              phone
                ? "text-muted-foreground font-medium"
                : "text-muted-foreground/70",
            )}
          >
            {phone || "No phone added"}
          </p>
          {meta && (
            <p className="text-muted-foreground/70 mt-0.5 truncate text-[13px]">
              {meta}
            </p>
          )}
        </div>
      </div>

      {/* Data block: Instagram + class, the member's real state — all of it,
          right here so the buttons below stay data-agnostic. */}
      <div className="border-border/60 mt-4 flex flex-col gap-2.5 border-t pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="bg-pink-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
            <Instagram className="h-[15px] w-[15px]" />
          </span>
          {igConnected ? (
            <>
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {handle ? `@${handle}` : "Connected"}
              </span>
              {followers > 0 && (
                <span className="text-muted-foreground shrink-0 text-[12px]">
                  {followers.toLocaleString("en-US")} followers
                </span>
              )}
              <BadgeCheck className="text-foreground/60 ml-auto h-[18px] w-[18px] shrink-0" />
            </>
          ) : (
            <span className="text-muted-foreground/80 text-[13px]">
              Not connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm",
              isPremium
                ? "bg-tier-premium text-white"
                : "bg-amber-400/20 text-amber-700",
            )}
          >
            <Crown className="h-[15px] w-[15px]" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">
            Mesita {classLabel}
          </span>
          {classVia && (
            <span className="text-muted-foreground text-[12px]">
              via {classVia}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
