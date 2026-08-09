"use client";

import { useState } from "react";
import { GoogleLogo, MesitaSourceBadge } from "./BrandLogos";
import { Header, Quote, StarRow, Thumbnail } from "./review-card-parts";
import { cn, firstInitial } from "@/lib/utils";
import type { ClassKey } from "@/lib/consumer-data";
import type { PlaceDetail } from "@/lib/mock/place";
import { CLASS_AVATAR_BG, CLASS_TEXT } from "@/lib/class-styles";

// Individual review card — same skeleton for Mesita and Google, with the
// source-specific bits (italic-serif quote vs sans, class chip vs none,
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

const CLASS_LABEL: Record<ClassKey, string> = {
  standard: "STANDARD",
  premium: "PREMIUM",
  influencer: "INFLUENCER",
  aura: "AURA",
};

type MesitaPayload = {
  kind: "mesita";
  data: PlaceDetail["mesita_visitors"][number];
};

type GooglePayload = {
  kind: "google";
  data: PlaceDetail["google_reviews"][number];
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
                CLASS_AVATAR_BG[v.class_key],
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
                CLASS_TEXT[v.class_key],
              )}
            >
              {CLASS_LABEL[v.class_key]}
            </span>
          }
          sourceLogo={<MesitaSourceBadge />}
        />
        <StarRow rating={overall} />
        <p className="text-muted-foreground text-[10px] leading-snug">
          Overall{" "}
          <span className="text-foreground font-semibold">{overall}</span>
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
        sub={formatReviewDate(r.date)}
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

// Brand source badges (MesitaSourceBadge, GoogleLogo) live in BrandLogos.tsx —
// shared with the place detail page so the SVG and pink-gradient mark
// don't drift between surfaces.

/** Enricher stores ISO `published`; mocks use relative strings — show either cleanly. */
function formatReviewDate(raw: string): string {
  if (!raw) return "";
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return raw;
  const diffMs = Date.now() - t;
  if (diffMs < 0) {
    return new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const day = 86_400_000;
  if (diffMs < day) return "Today";
  if (diffMs < 2 * day) return "Yesterday";
  if (diffMs < 7 * day) {
    const n = Math.floor(diffMs / day);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 30 * day) {
    const n = Math.floor(diffMs / (7 * day));
    return `${n} week${n === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 365 * day) {
    const n = Math.floor(diffMs / (30 * day));
    return `${n} month${n === 1 ? "" : "s"} ago`;
  }
  const n = Math.floor(diffMs / (365 * day));
  return `${n} year${n === 1 ? "" : "s"} ago`;
}
