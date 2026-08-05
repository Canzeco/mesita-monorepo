"use client";

import Image from "next/image";
import { Instagram } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { formatCurrency } from "@/lib/api/profile";
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

// ─── ID-1 membership card (MESITA-930) ──────────────────────────────────────
// Dual badges under photo: Cls (class gem) + IG (ring + face). Class once —
// no header ClassChip. Right stack = identity. Footer = Saved · Visits · Stories.

const CLASS_LETTER: Record<string, string> = {
  standard: "S",
  premium: "P",
  influencer: "I",
  aura: "A",
};

function ClassBadge({
  classKey,
  label,
}: {
  classKey: string;
  label: string;
}) {
  const chipClass =
    classKey === "aura"
      ? "bg-gradient-to-br from-amber-200 to-orange-300 text-amber-950"
      : classKey === "influencer"
        ? "bg-gradient-to-br from-sky-200 to-sky-400 text-sky-950"
        : classKey === "premium"
          ? "bg-gradient-to-br from-violet-200 to-fuchsia-300 text-violet-950"
          : "bg-gradient-to-br from-primary/80 to-secondary/80 text-white";

  return (
    <div
      className={cn(
        "absolute -bottom-0.5 -left-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-[9px] font-extrabold shadow-sm",
        chipClass,
      )}
      aria-label={`Class: ${label}`}
    >
      {CLASS_LETTER[classKey] ?? "S"}
    </div>
  );
}

function IgBadge({
  connected,
  avatarUrl,
}: {
  connected: boolean;
  avatarUrl: string | null;
}) {
  return (
    <div
      className={cn(
        "absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-white p-[1.5px] shadow-sm",
        connected
          ? "bg-[linear-gradient(135deg,#f58529,#dd2a7b_45%,#8134af)]"
          : "bg-border",
      )}
      aria-label={
        connected ? "Instagram connected" : "Instagram not connected"
      }
    >
      <div className="bg-card grid h-[18px] w-[18px] place-items-center overflow-hidden rounded-full">
        {connected && avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={18}
            height={18}
            className="h-full w-full object-cover"
          />
        ) : (
          <Instagram
            className={cn(
              "h-2.5 w-2.5",
              connected ? "text-secondary" : "text-muted-foreground",
            )}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function ProfileSummaryCard({
  profile,
  savedCents,
  visits,
  stories,
  loading,
}: {
  profile: ConsumerProfile | null;
  savedCents: number | null;
  visits: number | null;
  stories: number | null;
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
          <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
          <div className="flex items-center gap-3">
            <div className="bg-muted h-14 w-14 shrink-0 animate-pulse rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-muted h-5 w-36 animate-pulse rounded" />
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-3 w-28 animate-pulse rounded" />
              <div className="bg-muted h-3 w-32 animate-pulse rounded" />
            </div>
          </div>
          <div className="bg-muted/80 grid grid-cols-3 gap-2 rounded-xl p-2">
            <div className="bg-muted h-8 animate-pulse rounded" />
            <div className="bg-muted h-8 animate-pulse rounded" />
            <div className="bg-muted h-8 animate-pulse rounded" />
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
  const igLine = igConnected
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
        <span className="font-display text-foreground/35 text-[10px] font-bold tracking-[0.28em] uppercase select-none">
          Mesita
        </span>

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
            <ClassBadge classKey={key} label={classLabel} />
            <IgBadge connected={igConnected} avatarUrl={avatarUrl} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-[17px] leading-tight font-bold tracking-tight">
              {name}
            </h2>
            {whisper ? (
              <p className="text-muted-foreground mt-0.5 truncate text-[11px] font-medium">
                {whisper}
              </p>
            ) : null}
            {phone ? (
              <p className="text-foreground/70 mt-0.5 truncate font-mono text-[11px] font-semibold tracking-wide tabular-nums">
                {phone}
              </p>
            ) : null}
            <p
              className={cn(
                "mt-0.5 truncate text-[11px] font-semibold",
                igConnected ? "text-secondary" : "text-muted-foreground/70",
              )}
            >
              {igLine}
            </p>
          </div>
        </div>

        <div
          className="border-border/80 grid grid-cols-3 gap-1 rounded-xl border bg-white/55 px-2 py-1.5"
          aria-label="Your Mesita metrics"
        >
          <MetricCell
            value={
              savedCents == null ? "—" : formatCurrency(savedCents)
            }
            label="Saved"
          />
          <MetricCell
            value={visits == null ? "—" : String(visits)}
            label="Visits"
          />
          <MetricCell
            value={stories == null ? "—" : String(stories)}
            label="Stories"
          />
        </div>
      </div>
    </section>
  );
}

function MetricCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="font-display truncate text-[13px] font-bold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="text-muted-foreground mt-0.5 text-[8px] font-bold tracking-[0.06em] uppercase">
        {label}
      </div>
    </div>
  );
}
