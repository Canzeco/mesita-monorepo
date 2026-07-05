"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Instagram, Crown, Ticket, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { displayConsumerCode } from "@/lib/consumer-code";
import { useMembership, type Membership } from "@/lib/membership-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The Rewards → QR tab. Not a receipt: a membership *passport*. A single
// premium dark-gradient card carries the QR, the Mesita code, and an
// identity strip (name · plan · Instagram reach) so showing it at the table
// reads like flashing a card. Mirrors the Lovable "Mesita" prototype's
// QrView (src/routes/rewards.tsx).

function classPresentation(m: Membership): {
  label: string;
  Glyph: typeof Instagram;
  glyphClass: string;
} {
  if (m.tier !== "premium") {
    return {
      label: "Free",
      Glyph: Ticket,
      glyphClass: "bg-white/12 text-white",
    };
  }
  switch (m.origin) {
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
  const membership = useMembership();
  const { label, Glyph, glyphClass } = classPresentation(membership);
  const displayName = name?.trim() || "Mesita member";
  const isFree = membership.tier !== "premium";
  const isInstagram = membership.origin === "instagram";

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
    <div className="space-y-5">
      {/* Passport card */}
      <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#0f0a26_0%,#1a1140_58%,#2b1a5c_100%)] p-5 text-white shadow-[0_24px_60px_-24px_rgba(15,10,40,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.25em] text-white/60 uppercase">
            Mesita Card
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
            MX · MTY
          </span>
        </div>

        {/* QR */}
        <div className="mx-auto mt-5 w-full max-w-[260px] rounded-3xl bg-white p-4">
          <QRCodeSVG
            value={`mesita:${displayCode}`}
            size={260}
            className="h-auto w-full"
            bgColor="#ffffff"
            fgColor="#0f0a26"
            level="M"
            marginSize={0}
          />
        </div>

        {/* Code */}
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Code copied" : "Copy code"}
          className="mx-auto mt-4 flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 py-2 font-mono text-sm font-semibold tracking-[0.3em] text-white transition active:scale-[0.99]"
        >
          {displayCode}
          {copied ? (
            <Check className="size-3.5 text-white/70" />
          ) : (
            <Copy className="size-3.5 text-white/50" />
          )}
        </button>

        {/* Identity strip */}
        <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12 text-sm font-bold text-white ring-2 ring-white/15">
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="text-[10px] font-semibold tracking-widest text-white/60 uppercase">
              {label}
              {isInstagram && membership.followers > 0
                ? ` · ${formatFollowers(membership.followers)} followers`
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

      {/* Helper caption */}
      <p className="text-muted-foreground px-6 text-center text-[12px] leading-snug">
        Show this when you ask for the check. Staff scan the QR or type your
        8-digit code in WhatsApp or their console.
      </p>

      {/* Premium nudge — Free only */}
      {isFree ? (
        <Link
          href={CONSUMER_ROUTES.me.class}
          className="border-border surface-card flex items-center gap-3 rounded-2xl px-4 py-3.5 transition active:scale-[0.99]"
        >
          <span className="bg-tier-premium grid size-10 shrink-0 place-items-center rounded-xl text-white">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-bold">Unlock Premium</p>
            <p className="text-muted-foreground text-[11px]">
              Bigger discounts and Type B rewards — free with Instagram.
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
