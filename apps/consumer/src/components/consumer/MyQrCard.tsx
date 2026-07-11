"use client";

import { useState } from "react";
import { Check, Copy, Crown, Flame, Instagram, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { displayConsumerCode } from "@/lib/consumer-code";
import { formatCurrency } from "@/lib/api/profile";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";
import type { RewardStats } from "@/lib/hooks/useConsumerPayTickets";

// The Rewards passport — a branded coral card that carries the QR, the member
// code, identity (name · Instagram · class + its door), and a member
// scorecard. Showing it at the table reads like flashing a membership card.
// The QR stays a scannable dark-on-white plate; everything around it is the
// gradient hero (the one place white-on-color is allowed on this surface).

const ORIGIN_LABEL: Record<string, string> = {
  instagram: "Instagram",
  subscription: "Subscription",
  invitation: "Invite",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "M";
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative flex flex-col items-center px-1 text-center">
      <span className="text-lg leading-none font-extrabold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[8.5px] font-bold tracking-[0.06em] text-white/80 uppercase">
        {label}
      </span>
    </div>
  );
}

export function MyQrCard({
  code,
  name,
  instagramHandle,
  stats,
}: {
  code: string;
  name?: string;
  instagramHandle?: string | null;
  stats?: RewardStats;
}) {
  const displayCode = displayConsumerCode(code);
  const { key, origin, followers } = useConsumerClass();
  const isPremium = key === "premium";
  const displayName = name?.trim() || "Mesita member";
  const igConnected = origin === "instagram" || Boolean(instagramHandle);

  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const s = stats ?? { visits: 0, savedCents: 0, stories: 0, reviews: 0 };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] px-5 pt-5 pb-5 text-white shadow-[0_20px_44px_-22px_rgba(255,77,109,0.6)]",
        isPremium
          ? "bg-[linear-gradient(150deg,#ff7a45_0%,#ff3d73_45%,#a13cf0_100%)]"
          : "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]",
      )}
    >
      {/* Header — brand + class chip */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <span className="grid size-7 place-items-center rounded-[9px] bg-white/20">
            <Flame className="size-4 fill-current" />
          </span>
          Mesita Card
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/22 px-2.5 py-1 text-[10px] font-extrabold tracking-widest uppercase">
          {isPremium ? <Crown className="size-3 fill-current" /> : null}
          {isPremium ? "Premium" : "Free"}
        </span>
      </div>

      {/* QR — the hero. Dark-on-white plate so it always scans. */}
      <div className="mx-auto mt-4 w-full max-w-[212px]">
        <div className="w-full rounded-[22px] bg-white p-4 shadow-[0_12px_30px_-12px_rgba(120,20,40,0.5)]">
          <QRCodeSVG
            value={`mesita:${displayCode}`}
            size={220}
            className="h-auto w-full"
            bgColor="#ffffff"
            fgColor="#2b1233"
            level="H"
            marginSize={0}
            imageSettings={{
              src: "/brand/mesita-mark.svg",
              height: 44,
              width: 44,
              excavate: true,
            }}
          />
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Code copied" : "Copy code"}
          className="mt-3 flex w-full items-center justify-center gap-2 font-mono text-lg font-semibold tracking-[0.22em] text-white transition active:scale-[0.99]"
        >
          {displayCode}
          {copied ? (
            <Check className="size-4 text-white/80" />
          ) : (
            <Copy className="size-4 text-white/60" />
          )}
        </button>
      </div>

      {/* Identity strip — the passport: who, and (when connected) Instagram +
          the class door. */}
      <div className="mt-4 flex items-center gap-3 border-t border-white/22 pt-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/18 text-sm font-extrabold ring-2 ring-white/30">
          {initialsOf(displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-tight">
            {displayName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/90">
            {isPremium ? (
              <>
                <Crown className="size-3 shrink-0 fill-current" />
                Premium · via {ORIGIN_LABEL[origin] ?? "Mesita"}
              </>
            ) : (
              "Free member"
            )}
          </p>
        </div>
      </div>

      {igConnected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {instagramHandle ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/17 px-2.5 py-1.5 text-[11.5px] font-semibold">
              <Instagram className="size-3.5" />@{instagramHandle}
            </span>
          ) : null}
          {followers > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/17 px-2.5 py-1.5 text-[11.5px] font-semibold">
              <Users className="size-3.5" />
              {formatFollowers(followers)} followers
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Member scorecard */}
      <div className="mt-4 grid grid-cols-4 gap-1 border-t border-white/22 pt-4">
        <Stat value={String(s.visits)} label="Visits" />
        <Stat
          value={s.savedCents > 0 ? formatCurrency(s.savedCents) : "—"}
          label="Saved"
        />
        <Stat value={String(s.stories)} label="Stories" />
        <Stat value={String(s.reviews)} label="Reviews" />
      </div>
    </section>
  );
}
