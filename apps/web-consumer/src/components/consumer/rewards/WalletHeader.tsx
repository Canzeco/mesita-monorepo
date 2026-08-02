"use client";

// The wallet's identity header (Wallet v3, MESITA-811): strictly who you are —
// avatar, name, class chip. Nothing else by spec: the old ContextStrip's
// "up to N%" ceiling and Premium door left the page, and the member code
// moved into the venue pass modal, next to the QR it backs up.

import { Crown } from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel, isElevatedClass } from "@/lib/consumer-data";
import { cn, firstInitials } from "@/lib/utils";

export function WalletHeader({ name }: { name?: string }) {
  const { key } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  const displayName = name?.trim() || "Mesita member";

  return (
    <section className="border-border bg-card flex items-center gap-3 rounded-2xl border px-3.5 py-3">
      <span className="bg-pink-gradient grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white">
        {firstInitials(displayName)}
      </span>
      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] leading-tight font-bold">
        <span className="truncate">{displayName}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest uppercase",
            isElevated
              ? "bg-tier-premium/10 text-premium"
              : "bg-primary/10 text-primary",
          )}
        >
          {isElevated ? <Crown className="size-2.5 fill-current" /> : null}
          {classProperLabel(key)}
        </span>
      </p>
    </section>
  );
}
