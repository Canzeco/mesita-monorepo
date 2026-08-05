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
  formatPhoneDisplay,
  formatSex,
} from "@/lib/utils";

// ─── Mesita passport v2 (MESITA-901) ────────────────────────────────────────
// A presentation card: everything sits on the center axis like a physical
// membership card. Issuer line (hairline · MESITA · hairline) on top, then a
// centered ring avatar over a centered name / phone / meta stack, then a
// full-width stat band of three EXACTLY equal, center-aligned columns
// (Instagram · Class · Visits) split by hairline separators.

// One stat column: centered small-caps label over a centered value, with an
// optional muted sub-line (followers, class origin).
function PassportField({
  label,
  value,
  sub,
  muted = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  /** Dim the value for absent data ("Not connected"). */
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
      {sub && (
        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
          {sub}
        </p>
      )}
    </div>
  );
}

// Issuer line: MESITA wordmark on the center axis, flanked by hairlines —
// the engraved header of the card.
function IssuerLine() {
  return (
    <div className="flex items-center justify-center gap-3">
      <span aria-hidden className="bg-foreground/15 h-px w-9" />
      <span className="font-display text-foreground/40 text-[10px] font-bold tracking-[0.3em] uppercase select-none">
        Mesita
      </span>
      <span aria-hidden className="bg-foreground/15 h-px w-9" />
    </div>
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
  // Aura (top of the ladder) reads gold, Influencer reads sky, Premium its
  // violet token — the ring is the class's color signature on the card.
  const elevatedBg =
    key === "aura"
      ? "bg-tier-gold"
      : key === "influencer"
        ? "bg-sky-600"
        : "bg-tier-premium";

  if (loading) {
    return (
      <div className="border-border bg-muted/50 overflow-hidden rounded-3xl border px-4 pt-4 pb-4">
        {/* Issuer-line stub, centered. */}
        <div className="bg-muted mx-auto h-2.5 w-24 animate-pulse rounded" />
        {/* Avatar: 76px to match the real ring avatar (66px + 2x2.5px rings). */}
        <div className="bg-muted mx-auto mt-4 h-[76px] w-[76px] animate-pulse rounded-full" />
        <div className="mt-3 space-y-2">
          <div className="bg-muted mx-auto h-5 w-40 animate-pulse rounded" />
          <div className="bg-muted mx-auto h-3.5 w-28 animate-pulse rounded" />
          <div className="bg-muted mx-auto h-3.5 w-20 animate-pulse rounded" />
        </div>
        {/* Stat-band placeholder: three equal centered label/value stubs. */}
        <div className="border-border/60 mt-4 grid grid-cols-3 border-t pt-3.5">
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
  const phone = formatPhoneDisplay(profile?.phone);

  // Sex + age on one line under the phone — country is intentionally omitted.
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const meta = [sexLabel, age != null ? `${age}` : null]
    .filter(Boolean)
    .join(" · ");

  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Standard";
  const classVia = isElevated && origin !== "default" ? origin : null;
  // Real handle lives on the profile; fall back to the class-context handle
  // (carries the demo handle for the Instagram preview state).
  const handle = profile?.instagram_handle ?? classHandle;
  const igConnected = origin === "instagram" || Boolean(handle);

  return (
    // Branded tinted panel — a soft class-tinted gradient so the passport
    // reads premium and distinct from the white option boxes below.
    <section
      className={cn(
        "border-border overflow-hidden rounded-3xl border px-4 pt-4 pb-4",
        isElevated
          ? "from-primary/[0.14] via-secondary/[0.10] to-accent/[0.12] bg-gradient-to-br"
          : "from-primary/[0.08] via-secondary/[0.06] to-accent/[0.08] bg-gradient-to-br",
      )}
    >
      <IssuerLine />

      {/* Story-ring avatar on the center axis: class-tinted gradient ring. */}
      <div className="mt-4 flex justify-center">
        <div
          className={cn(
            "rounded-full p-[2.5px]",
            isElevated ? elevatedBg : "bg-pink-gradient",
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
                <DefaultAvatar className="h-full w-full" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Centered identity stack: name over phone over sex · age. */}
      <div className="mt-3 text-center">
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

      {/* Stat band: Instagram · Class · Visits — three equal centered columns
          split by hairlines, one deliberate band. The connect CTA lives on
          the Instagram box below — the card states, it never nags. */}
      <div className="border-border/60 mt-4 grid grid-cols-3 border-t pt-3.5">
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
          sub={
            igConnected && followers > 0
              ? `${followers.toLocaleString("en-US")} followers`
              : null
          }
        />
        <PassportField
          label="Class"
          value={classLabel}
          sub={classVia ? `via ${classVia}` : null}
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
