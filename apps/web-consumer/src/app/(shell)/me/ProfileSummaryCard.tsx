"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Instagram, type LucideIcon } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { formatCurrency } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CLASSES, CLASS_ICONS, isElevatedClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatPhoneDisplay,
  formatSex,
  phoneCountryFlag,
} from "@/lib/utils";

// ─── Me membership card (MESITA-932 / MESITA-935 / MESITA-937) ──────────────
// Centered photo + Class/IG badges, then five equal-height identity rows:
// name·sex·age / 🇲🇽 phone / [icon] class / IG handle·followers / visits·saved.
// Typography: Fraunces only on MESITA wordmark; all identity rows = Inter.

const ROW_CLASS =
  "flex h-11 items-center justify-center gap-1.5 px-3 text-center";

function ClassBadge({
  classKey,
  label,
}: {
  classKey: keyof typeof CLASS_ICONS;
  label: string;
}) {
  const Icon = CLASS_ICONS[classKey];
  const chipClass =
    classKey === "aura"
      ? "bg-gradient-to-br from-amber-200 to-orange-300 text-amber-950"
      : classKey === "influencer"
        ? "bg-gradient-to-br from-red-200 to-red-400 text-red-950"
        : classKey === "premium"
          ? "bg-gradient-to-br from-blue-200 to-blue-400 text-blue-950"
          : "bg-gradient-to-br from-neutral-200 to-neutral-400 text-neutral-900";

  // Same outer diameter as IgBadge (MESITA-938) — 28px, equal left/right.
  return (
    <div
      className={cn(
        "absolute -bottom-1 -left-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white shadow-sm",
        chipClass,
      )}
      aria-label={`Class: ${label}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
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
  // Same outer diameter as ClassBadge (MESITA-938) — 28px h-7 w-7.
  return (
    <div
      className={cn(
        "absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white p-[2px] shadow-sm",
        connected
          ? "bg-[linear-gradient(135deg,#f58529,#dd2a7b_45%,#8134af)]"
          : "bg-border",
      )}
      aria-label={
        connected ? "Instagram connected" : "Instagram not connected"
      }
    >
      <div className="bg-card grid h-full w-full place-items-center overflow-hidden rounded-full">
        {connected && avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={20}
            height={20}
            className="h-full w-full object-cover"
          />
        ) : (
          <Instagram
            className={cn(
              "h-3.5 w-3.5",
              connected ? "text-secondary" : "text-muted-foreground",
            )}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function RowWithIcon({
  Icon,
  children,
  iconClassName,
}: {
  Icon: LucideIcon;
  children: ReactNode;
  iconClassName?: string;
}) {
  return (
    <>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", iconClassName)}
        strokeWidth={2.25}
        aria-hidden
      />
      {children}
    </>
  );
}

export function ProfileSummaryCard({
  profile,
  savedCents,
  visits,
  loading,
}: {
  profile: ConsumerProfile | null;
  savedCents: number | null;
  visits: number | null;
  loading: boolean;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  const elevatedBg =
    key === "aura"
      ? "bg-tier-gold"
      : key === "influencer"
        ? "bg-tier-influencer"
        : "bg-tier-premium";

  if (loading) {
    return (
      <div className="border-border bg-muted/50 w-full overflow-hidden rounded-2xl border px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
          <div className="bg-muted h-[72px] w-[72px] animate-pulse rounded-full" />
          <div className="bg-muted/80 w-full overflow-hidden rounded-xl">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="border-border/60 flex h-11 items-center justify-center border-b last:border-b-0"
              >
                <div className="bg-muted h-3 w-28 animate-pulse rounded" />
              </div>
            ))}
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
  const flag = phoneCountryFlag(profile?.phone);
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Standard";
  const ClassIcon = CLASS_ICONS[key];
  // Prefer class-context handle so IG mock (@mock) wins over a stale profile.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

  const identityLine = [name, sexLabel, age != null ? String(age) : null]
    .filter(Boolean)
    .join(" · ");
  const igLine = igConnected
    ? [handle ? `@${handle}` : "Connected", formatCompactCount(followers)]
        .filter(Boolean)
        .join(" · ")
    : "Instagram not connected";
  const metricsLine = [
    visits == null ? "— visits" : `${visits} visits`,
    savedCents == null ? "— saved" : `${formatCurrency(savedCents)} saved`,
  ].join(" · ");

  const rows: { key: string; content: ReactNode; muted?: boolean }[] = [
    {
      key: "identity",
      content: (
        <span className="truncate text-[15px] font-bold tracking-tight">
          {identityLine}
        </span>
      ),
    },
    {
      key: "phone",
      content: (
        <>
          {flag ? (
            <span className="text-[14px] leading-none" aria-hidden>
              {flag}
            </span>
          ) : null}
          <span className="truncate text-[13px] font-semibold tracking-wide tabular-nums">
            {phone || "—"}
          </span>
        </>
      ),
      muted: !phone,
    },
    {
      key: "class",
      content: (
        <RowWithIcon Icon={ClassIcon} iconClassName="text-foreground/70">
          <span className="truncate text-[13px] font-semibold">
            {classLabel}
          </span>
        </RowWithIcon>
      ),
    },
    {
      key: "instagram",
      content: (
        <span
          className={cn(
            "truncate text-[13px] font-semibold",
            igConnected ? "text-secondary" : "text-muted-foreground",
          )}
        >
          {igLine}
        </span>
      ),
    },
    {
      key: "metrics",
      content: (
        <span className="truncate text-[13px] font-semibold tabular-nums">
          {metricsLine}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-label="Your Mesita membership card"
      className={cn(
        "border-border w-full overflow-hidden rounded-2xl border px-4 py-4",
        isElevated
          ? "from-primary/[0.14] via-secondary/[0.08] to-accent/[0.10] bg-gradient-to-br"
          : "from-primary/[0.10] via-secondary/[0.06] to-accent/[0.07] bg-gradient-to-br",
      )}
    >
      <div className="flex flex-col items-center">
        <span className="font-display text-foreground/35 text-[10px] font-bold tracking-[0.28em] uppercase select-none">
          Mesita
        </span>

        <div className="relative mt-3 shrink-0">
          <div
            className={cn(
              "rounded-full p-[2px]",
              isElevated ? elevatedBg : "bg-pink-gradient",
            )}
          >
            <div className="bg-card rounded-full p-[2px]">
              <div className="bg-muted relative h-[72px] w-[72px] overflow-hidden rounded-full">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={name}
                    fill
                    sizes="72px"
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

        <div
          className="border-border/80 mt-4 w-full overflow-hidden rounded-xl border bg-white/55"
          role="list"
          aria-label="Your identity"
        >
          {rows.map((row, i) => (
            <div
              key={row.key}
              role="listitem"
              className={cn(
                ROW_CLASS,
                i < rows.length - 1 && "border-border/70 border-b",
                row.muted && "text-muted-foreground",
              )}
            >
              {row.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
