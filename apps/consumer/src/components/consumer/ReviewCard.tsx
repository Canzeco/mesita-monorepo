"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { cn, firstInitial } from "@/lib/utils";
import type { Tier, VenueDetail } from "@/lib/mock/venue";

// Individual review card — same skeleton for Mesita and Google, with the
// source-specific bits (italic-serif quote vs sans, tier chip vs none,
// per-category ratings vs star row) toggled by the `kind` prop. Lives in
// its own client file because the long-quote read-more toggle needs state.
//
//   [Avatar] [Name + sub]                          [Source logo]
//   ★★★★★ · date / dined-on
//   Overall N · Food N · Service N · Ambience N · Value N    (Mesita only)
//   "Quote..." (truncated)
//   [Read more]                                              (when truncated)
//   [Photo thumbnail]                                        (when present)

const LONG_QUOTE_THRESHOLD = 220;

const TIER_AVATAR_BG: Record<Tier, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};

const TIER_TEXT: Record<Tier, string> = {
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
  diamond: "text-sky-400",
};

const TIER_LABEL: Record<Tier, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  diamond: "DIAMOND",
};

type MesitaPayload = {
  kind: "mesita";
  data: VenueDetail["mesita_visitors"][number];
};

type GooglePayload = {
  kind: "google";
  data: VenueDetail["google_reviews"][number];
};

export function ReviewCard(props: MesitaPayload | GooglePayload) {
  const [expanded, setExpanded] = useState(false);
  if (props.kind === "mesita") {
    const v = props.data;
    const overall = Math.round((v.food + v.service + v.ambiance + v.value) / 4);
    const isLong = v.quote.length > LONG_QUOTE_THRESHOLD;
    return (
      <article className="bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4">
        <Header
          avatar={
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white/90",
                TIER_AVATAR_BG[v.tier],
              )}
            >
              {firstInitial(v.name)}
            </div>
          }
          name={v.name}
          sub={v.handle}
          rightChip={
            <span
              className={cn(
                "rounded-full border border-current/30 px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase",
                TIER_TEXT[v.tier],
              )}
            >
              {TIER_LABEL[v.tier]}
            </span>
          }
          sourceLogo={<MesitaGlyph />}
        />
        <StarRow rating={overall} />
        <p className="text-muted-foreground text-[10px] leading-snug">
          Overall <span className="text-foreground font-semibold">{overall}</span>
          {" · "}Food{" "}
          <span className="text-foreground font-semibold">{v.food}</span>
          {" · "}Service{" "}
          <span className="text-foreground font-semibold">{v.service}</span>
          {" · "}Ambience{" "}
          <span className="text-foreground font-semibold">{v.ambiance}</span>
          {" · "}Value{" "}
          <span className="text-foreground font-semibold">{v.value}</span>
        </p>
        <Quote
          text={v.quote}
          italic
          truncated={isLong && !expanded}
          onExpand={isLong && !expanded ? () => setExpanded(true) : undefined}
        />
        {v.photo_url && <Thumbnail src={v.photo_url} alt={`${v.name}'s photo`} />}
      </article>
    );
  }
  const r = props.data;
  const isLong = r.quote.length > LONG_QUOTE_THRESHOLD;
  return (
    <article className="bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4">
      <Header
        avatar={
          <div className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {firstInitial(r.author)}
          </div>
        }
        name={r.author}
        sub={r.date}
        sourceLogo={<GoogleGlyph />}
      />
      <StarRow rating={r.rating} />
      <Quote
        text={r.quote}
        truncated={isLong && !expanded}
        onExpand={isLong && !expanded ? () => setExpanded(true) : undefined}
      />
      {r.photo_url && <Thumbnail src={r.photo_url} alt={`${r.author}'s photo`} />}
    </article>
  );
}

function Header({
  avatar,
  name,
  sub,
  rightChip,
  sourceLogo,
}: {
  avatar: React.ReactNode;
  name: string;
  sub: string;
  rightChip?: React.ReactNode;
  sourceLogo: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{name}</p>
          {rightChip}
        </div>
        <p className="text-muted-foreground truncate text-[11px]">{sub}</p>
      </div>
      {sourceLogo}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-current" : "opacity-30",
          )}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

function Quote({
  text,
  italic,
  truncated,
  onExpand,
}: {
  text: string;
  italic?: boolean;
  truncated: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "text-foreground text-sm leading-snug",
          italic && "font-display italic",
          truncated && "line-clamp-4",
        )}
      >
        “{text}”
      </p>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="text-foreground self-start text-[11px] font-semibold hover:underline"
        >
          Read more
        </button>
      )}
    </div>
  );
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mt-auto h-28 w-full overflow-hidden rounded-xl">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="288px"
        className="object-cover"
      />
    </div>
  );
}

// Compact brand glyphs reused from VenueDetailBody. Inlined here so the
// client component stays self-contained and doesn't pull the server file's
// helpers across the boundary.

function MesitaGlyph() {
  return (
    <span className="bg-pink-gradient font-display flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[13px] font-bold leading-none text-white">
      m
    </span>
  );
}

function GoogleGlyph() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    </div>
  );
}
