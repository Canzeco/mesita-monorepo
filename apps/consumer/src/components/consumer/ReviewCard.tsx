"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { GoogleLogo, MesitaMark } from "./BrandLogos";
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
  diamond: "text-sky-600",
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
          sourceLogo={<MesitaMark />}
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
        {v.photo_url && (
          <Thumbnail
            src={v.photo_url}
            alt={`${v.name}'s photo`}
            aspect={v.photo_aspect ?? "landscape"}
          />
        )}
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
        sourceLogo={<GoogleLogo />}
      />
      <StarRow rating={r.rating} />
      <Quote
        text={r.quote}
        truncated={isLong && !expanded}
        onExpand={isLong && !expanded ? () => setExpanded(true) : undefined}
      />
      {r.photo_url && (
        <Thumbnail
          src={r.photo_url}
          alt={`${r.author}'s photo`}
          aspect={r.photo_aspect ?? "landscape"}
        />
      )}
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

function Thumbnail({
  src,
  alt,
  aspect,
}: {
  src: string;
  alt: string;
  aspect: "square" | "portrait" | "landscape";
}) {
  // Photos sit in a 40-unit-wide (160px) frame centered in the card
  // rather than spanning full width — full-width portrait shots were
  // dominating the layout. The aspect class drives the height so a
  // story stays tall (160 × 213), a square food shot stays square
  // (160 × 160), and a landscape dining shot stays wide-short
  // (160 × 90).
  const aspectClass =
    aspect === "portrait"
      ? "aspect-[3/4]"
      : aspect === "landscape"
        ? "aspect-[16/9]"
        : "aspect-square";
  return (
    <div className="mt-auto flex justify-center">
      <div
        className={cn(
          "relative w-40 overflow-hidden rounded-xl",
          aspectClass,
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="160px"
          className="object-cover"
        />
      </div>
    </div>
  );
}

// Brand source badges (MesitaMark, GoogleLogo) live in BrandLogos.tsx —
// shared with the venue detail page so the SVG and pink-gradient mark
// don't drift between surfaces.
