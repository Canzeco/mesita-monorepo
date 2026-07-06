"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Instagram,
  Crown,
  Ticket,
  Sparkles,
  Percent,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { displayConsumerCode } from "@/lib/consumer-code";
import {
  useConsumerClass,
  type ConsumerClassState,
} from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The Rewards → QR tab. Not a receipt: a class *passport*. A single
// premium dark-gradient card carries the QR, the Mesita code, and an
// identity strip (name · class · Instagram reach) so showing it at the table
// reads like flashing a card. Mirrors the Lovable "Mesita" prototype's
// QrView (src/routes/rewards.tsx).

function classPresentation(c: ConsumerClassState): {
  label: string;
  Glyph: typeof Instagram;
  glyphClass: string;
} {
  if (c.key !== "premium") {
    return {
      label: "Free",
      Glyph: Ticket,
      glyphClass: "bg-white/12 text-white",
    };
  }
  switch (c.origin) {
    case "instagram":
      return {
        label: "Premium · Instagram",
        Glyph: Instagram,
        glyphClass:
          "bg-[linear-gradient(135deg,#feda75,#d62976_55%,#4f5bd5)] text-white",
      };
    case "invitation":
      return {
        label: "Premium · Invite",
        Glyph: Sparkles,
        glyphClass: "bg-white/15 text-white",
      };
    default:
      return {
        label: "Premium · Subscription",
        Glyph: Crown,
        glyphClass: "bg-[#f0c860] text-[#3a2a08]",
      };
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "M";
}

function formatFollowers(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

export function MyQrCard({ code, name }: { code: string; name?: string }) {
  const displayCode = displayConsumerCode(code);
  const consumerClass = useConsumerClass();
  const { label, Glyph, glyphClass } = classPresentation(consumerClass);
  const displayName = name?.trim() || "Mesita member";
  const isFree = consumerClass.key !== "premium";
  const isInstagram = consumerClass.origin === "instagram";

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

  return (
    <div className="space-y-3">
      {/* Passport card — two columns: passport/QR (left) + how-rewards-work
          info (right); the identity strip spans the bottom. */}
      <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(150deg,#0f0a26_0%,#1a1140_58%,#2b1a5c_100%)] p-4 text-white shadow-[0_20px_48px_-24px_rgba(15,10,40,0.55)]">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
          {/* LEFT — passport / QR */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-[0.22em] text-white/60 uppercase">
              Mesita Card
            </span>
            <div className="mt-2 w-full rounded-2xl bg-white p-2">
              <QRCodeSVG
                value={`mesita:${displayCode}`}
                size={220}
                className="h-auto w-full"
                bgColor="#ffffff"
                fgColor="#0f0a26"
                // High error correction (30%) so the QR still scans with the
                // Mesita mark excavated into the center.
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
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1.5 font-mono text-[13px] font-semibold tracking-[0.15em] text-white transition active:scale-[0.99]"
            >
              {displayCode}
              {copied ? (
                <Check className="size-3 text-white/70" />
              ) : (
                <Copy className="size-3 text-white/50" />
              )}
            </button>
          </div>

          {/* RIGHT — how rewards work + info */}
          <div className="flex flex-col justify-center gap-2.5">
            <span className="text-[9px] font-bold tracking-[0.18em] text-white/50 uppercase">
              How Rewards work
            </span>
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Percent className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <p className="text-[11px] leading-snug text-white/65">
                <span className="font-semibold text-white">
                  Instant discounts.
                </span>{" "}
                Straight off the bill when you show your code.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Crown className="h-3.5 w-3.5 fill-current" />
              </span>
              <p className="text-[11px] leading-snug text-white/65">
                <span className="font-semibold text-white">
                  Premium boosts them.
                </span>{" "}
                Bigger discounts than Free.
              </p>
            </div>
            <p className="text-[10px] leading-snug text-white/45">
              Show this at the check — staff scan it or type your code.
            </p>
          </div>
        </div>

        {/* Identity strip — spans both columns */}
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-sm font-bold text-white ring-2 ring-white/15">
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="text-[10px] font-semibold tracking-widest text-white/60 uppercase">
              {label}
              {isInstagram && consumerClass.followers > 0
                ? ` · ${formatFollowers(consumerClass.followers)} followers`
                : ""}
            </p>
          </div>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl ${glyphClass}`}
          >
            <Glyph className="size-4" />
          </span>
        </div>
      </section>

      {/* Premium nudge — Free only */}
      {isFree ? (
        <Link
          href={CONSUMER_ROUTES.me}
          className="border-border surface-card flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition active:scale-[0.99]"
        >
          <span className="bg-tier-premium grid size-9 shrink-0 place-items-center rounded-xl text-white">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-bold">Unlock Premium</p>
            <p className="text-muted-foreground text-[11px] leading-snug">
              Bigger discounts — free with Instagram.
            </p>
          </div>
          <span className="bg-tier-premium shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest text-white uppercase">
            Get it
          </span>
        </Link>
      ) : null}
    </div>
  );
}
