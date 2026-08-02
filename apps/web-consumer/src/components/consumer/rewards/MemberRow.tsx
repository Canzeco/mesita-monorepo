"use client";

// The Mesita Card, demoted to a compact identity row (MESITA-808, decision
// 2A). The passport QR is GONE from the product: since Tickets v2 nothing
// scans `mesita:<code>` — the ticket QR is the only scannable object, and two
// QRs on one page meant waiters scanning the dead one. The member code stays
// as text + copy because the WhatsApp staff bot still accepts it typed.

import { useState } from "react";
import { Check, Copy, Crown, Flame, Instagram } from "lucide-react";

import { displayConsumerCode } from "@/lib/consumer-code";
import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel, isElevatedClass } from "@/lib/consumer-data";
import { cn, firstInitials } from "@/lib/utils";

export function MemberRow({
  code,
  name,
  instagramHandle,
}: {
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const displayCode = displayConsumerCode(code);
  const { key } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  const displayName = name?.trim() || "Mesita member";

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
    <section className="border-border bg-card flex items-center gap-3 rounded-2xl border px-3.5 py-3">
      <span className="bg-pink-gradient grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white">
        {firstInitials(displayName) || <Flame className="size-4 fill-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13.5px] leading-tight font-bold">
          <span className="truncate">{displayName}</span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest uppercase",
              isElevated ? "bg-tier-premium/10 text-premium" : "bg-primary/10 text-primary",
            )}
          >
            {isElevated ? <Crown className="size-2.5 fill-current" /> : null}
            {classProperLabel(key)}
          </span>
        </p>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
          {instagramHandle ? (
            <span className="flex items-center gap-1">
              <Instagram className="size-3" />@{instagramHandle}
            </span>
          ) : (
            "Mesita Card"
          )}
        </p>
      </div>
      {/* The member code — kept as TEXT (the WhatsApp staff bot takes it
          typed); deliberately no QR anywhere on this row. */}
      <button
        type="button"
        onClick={() => void onCopy()}
        aria-label={copied ? "Code copied" : "Copy member code"}
        className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center gap-1.5 font-mono text-[13px] font-semibold tracking-[0.14em] transition"
      >
        {displayCode}
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </section>
  );
}
