"use client";

import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CLASSES, isElevatedClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatSex,
} from "@/lib/utils";

// ─── Membership Face Card (MESITA-904 · Variant B) ──────────────────────────
// Asymmetric membership card: issuer + Class chip header → photo + name face
// row → Age/Sex pills → metric band (Instagram · Followers · Visits).
// Phone lives in Personal details only — never on the card.

function PassportField({
  label,
  value,
  muted = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Dim the value for absent data ("Not connected" / "—"). */
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-2 text-center", className)}>
      <p className="text-muted-foreground/70 text-[10px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 truncate text-[14px] leading-tight font-semibold tracking-tight",
          muted && "text-muted-foreground/60 font-medium",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IssuerLine() {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="bg-foreground/15 h-px w-7" />
      <span className="font-display text-foreground/40 text-[10px] font-bold tracking-[0.3em] uppercase select-none">
        Mesita
      </span>
      <span aria-hidden className="bg-foreground/15 h-px w-7" />
    </div>
  );
}

function ClassChip({
  label,
  classKey,
}: {
  label: string;
  classKey: string;
}) {
  // Chip tint mirrors the ring: Aura gold / Influencer sky / Premium violet /
  // Standard pink. Label text carries the meaning (not color alone).
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] uppercase",
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
  /** Completed visits (revealed tickets) from consumer-web-get-profile. */
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
      <div className="border-border bg-muted/50 overflow-hidden rounded-3xl border px-4 pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-2.5 w-24 animate-pulse rounded" />
          <div className="bg-muted h-6 w-14 animate-pulse rounded-full" />
        </div>
        <div className="mt-3.5 flex items-center gap-3.5">
          <div className="bg-muted h-[72px] w-[72px] shrink-0 animate-pulse rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="bg-muted h-5 w-40 animate-pulse rounded" />
            <div className="flex gap-2">
              <div className="bg-muted h-5 w-12 animate-pulse rounded-lg" />
              <div className="bg-muted h-5 w-10 animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
        <div className="border-border/60 mt-3.5 grid grid-cols-3 border-t pt-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5 px-2">
              <div className="bg-muted mx-auto h-2.5 w-14 animate-pulse rounded" />
              <div className="bg-muted mx-auto h-4 w-16 animate-pulse rounded" />
            </div>
          ))}
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
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Standard";
  const handle = profile?.instagram_handle ?? classHandle;
  const igConnected = origin === "instagram" || Boolean(handle);

  return (
    <section
      aria-label="Your Mesita profile"
      className={cn(
        "border-border overflow-hidden rounded-3xl border px-4 pt-4 pb-3.5",
        isElevated
          ? "from-primary/[0.16] via-secondary/[0.09] to-accent/[0.12] bg-gradient-to-br"
          : "from-primary/[0.10] via-secondary/[0.07] to-accent/[0.08] bg-gradient-to-br",
      )}
    >
      {/* Header: issuer left · Class chip right */}
      <div className="flex items-center justify-between gap-3">
        <IssuerLine />
        <ClassChip label={classLabel} classKey={key} />
      </div>

      {/* Face row: photo + name + Age/Sex pills */}
      <div className="mt-3.5 flex items-center gap-3.5">
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isElevated ? elevatedBg : "bg-pink-gradient",
          )}
        >
          <div className="bg-card rounded-full p-[2.5px]">
            <div className="bg-muted relative flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  sizes="62px"
                  className="object-cover"
                />
              ) : (
                <DefaultAvatar className="h-full w-full" />
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[19px] leading-tight font-bold tracking-tight">
            {name}
          </h2>
          {(sexLabel || age != null) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sexLabel ? (
                <span className="text-muted-foreground border-border/60 rounded-lg border bg-white/55 px-2 py-0.5 text-[11px] font-semibold">
                  {sexLabel}
                </span>
              ) : null}
              {age != null ? (
                <span className="text-muted-foreground border-border/60 rounded-lg border bg-white/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                  {age}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Band: Instagram · Followers · Visits — Class is the header chip. */}
      <div className="border-border/60 mt-3.5 grid grid-cols-3 border-t pt-3.5">
        <PassportField
          label="Instagram"
          muted={!igConnected}
          value={
            igConnected ? (
              <span className="flex min-w-0 items-center justify-center gap-1">
                <span className="truncate">
                  {handle ? `@${handle}` : "Connected"}
                </span>
                <BadgeCheck className="text-foreground/50 h-[14px] w-[14px] shrink-0" />
              </span>
            ) : (
              "Not connected"
            )
          }
        />
        <PassportField
          label="Followers"
          muted={!igConnected}
          value={
            igConnected ? (
              <span className="tabular-nums">
                {formatCompactCount(followers)}
              </span>
            ) : (
              "—"
            )
          }
          className="border-border/60 border-l"
        />
        <PassportField
          label="Visits"
          value={<span className="tabular-nums">{visits ?? "—"}</span>}
          muted={visits == null}
          className="border-border/60 border-l"
        />
      </div>
    </section>
  );
}
