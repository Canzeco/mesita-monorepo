"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronRight,
  Copy,
  Crown,
  DoorOpen,
  Flame,
  Instagram,
  Megaphone,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { displayConsumerCode } from "@/lib/consumer-code";
import { formatCurrency } from "@/lib/api/profile";
import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel, isElevatedClass } from "@/lib/consumer-data";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { ConsumerClass } from "@/lib/mock/place";
import {
  PEAK_STRATEGY,
  reachableSegments,
  segmentKeyForClass,
  type RewardSegmentKey,
} from "@/lib/reward-segments";
import { cn, firstInitials, formatCompactCount } from "@/lib/utils";
import type {
  PassTicketView,
  RewardStats,
} from "@/lib/hooks/useConsumerPayTickets";

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



const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  premium: Crown,
  influencer: Megaphone,
  aura: Sparkles,
  story: Instagram,
  welcome: DoorOpen,
  review: Star,
};

// How each rung reads on the pass. Deliberately shorter than the ladder blurbs
// in reward-segments: the program card teaches, the pass just reminds.
const CLAIM_HINT: Record<RewardSegmentKey, string> = {
  standard: "Always on",
  premium: "Always on",
  influencer: "Always on",
  aura: "Always on",
  story: "Tag the place in a story",
  welcome: "At a place you haven't visited",
  review: "Once per place",
};

// State A — what this guest can claim ANYWHERE. The pass can't know the venue
// before the scan, so this is entitlement, never a per-place quote. The rung
// set (including the v6 Influencer-only Story gate) comes straight from
// reachableSegments so eligibility has exactly one home.
function ClaimBlock({ classKey }: { classKey: ConsumerClass }) {
  const mine = segmentKeyForClass(classKey);
  const rungs = reachableSegments(classKey);

  return (
    <div className="mt-4 border-t border-white/22 pt-4">
      <p className="text-[10px] font-bold tracking-[0.14em] text-white/75 uppercase">
        What you can claim
      </p>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {rungs.map((seg) => {
          const Icon = SEGMENT_ICON[seg.key];
          const isMine = seg.key === mine;
          return (
            <li
              key={seg.key}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
                isMine ? "bg-white/22" : "bg-white/10",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/20">
                <Icon className="size-[15px]" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-tight font-bold">
                  {seg.name}
                </span>
                <span className="block truncate text-[10.5px] text-white/75">
                  {isMine ? "Your class · always on" : CLAIM_HINT[seg.key]}
                </span>
              </span>
              <span className="shrink-0 text-[13px] leading-none font-extrabold tabular-nums">
                {seg.rates[PEAK_STRATEGY]}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10.5px] leading-snug text-white/70">
        You always keep your best one — never added together. The exact % is set
        by each place.
      </p>
    </div>
  );
}

// State B — a visit is in flight, so the venue and its rate are known and the
// pass stops guessing: it shows the resolved discount and the one thing left
// to do, and taps through to the ticket.
function LiveStrip({ ticket }: { ticket: PassTicketView }) {
  return (
    <Link
      href={`${CONSUMER_ROUTES.rewards.ticketPrefix}${ticket.ticketId}`}
      className="mt-4 flex items-center gap-3 rounded-2xl border border-white/25 bg-white/18 px-3 py-3 transition active:scale-[0.99]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/25">
        <Sparkles className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-tight font-extrabold">
          {ticket.discountPercent != null
            ? `${ticket.discountPercent}% off at ${ticket.placeName}`
            : `Visit open at ${ticket.placeName}`}
        </span>
        <span className="block truncate text-[11px] text-white/85">
          {ticket.pendingLabel ?? "Nothing left to do — enjoy it"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-white/70" />
    </Link>
  );
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
  activeTicket,
}: {
  code: string;
  name?: string;
  instagramHandle?: string | null;
  stats?: RewardStats;
  /** A visit in flight — flips the pass from entitlement to live state. */
  activeTicket?: PassTicketView | null;
}) {
  const displayCode = displayConsumerCode(code);
  const { key, origin, followers } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  // Standard = coral; Premium adds violet; Influencer shifts to sky; Aura
  // (top of the ladder) wears gold.
  const cardGradient =
    key === "aura"
      ? "bg-[linear-gradient(150deg,#ff7a45_0%,#ffb03d_55%,#e0982e_100%)]"
      : key === "influencer"
        ? "bg-[linear-gradient(150deg,#ff7a45_0%,#4aa8ff_55%,#2f7fd6_100%)]"
        : isElevated
          ? "bg-[linear-gradient(150deg,#ff7a45_0%,#ff3d73_45%,#a13cf0_100%)]"
          : "bg-[linear-gradient(150deg,#ff7a45_0%,#ff4d6d_55%,#ff2d78_100%)]";
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
        cardGradient,
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
          {isElevated ? <Crown className="size-3 fill-current" /> : null}
          {classProperLabel(key)}
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
          {firstInitials(displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-tight">
            {displayName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/90">
            {isElevated ? (
              <>
                <Crown className="size-3 shrink-0 fill-current" />
                {classProperLabel(key)} · via {ORIGIN_LABEL[origin] ?? "Mesita"}
              </>
            ) : (
              "Standard member"
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
              {formatCompactCount(followers)} followers
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The pass's answer to "what can I claim?" — entitlement at rest, the
          live visit once one is open. */}
      {activeTicket ? (
        <LiveStrip ticket={activeTicket} />
      ) : (
        <ClaimBlock classKey={key} />
      )}

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
