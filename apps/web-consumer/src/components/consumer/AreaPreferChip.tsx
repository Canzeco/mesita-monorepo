"use client";

// The Near/Popular toggle chip (MESITA-2425), h-11 like every chip: one tap
// flips it, and the label always names what the list is ranked by now.

import { toggleAreaPrefer, useAreaPrefer } from "@/lib/use-area-prefer";
import { cn } from "@/lib/utils";

const LABEL = {
  near: { emoji: "📍", text: "Near" },
  popular: { emoji: "🔥", text: "Popular" },
} as const;

export function AreaPreferChip({ className }: { className?: string }) {
  const prefer = useAreaPrefer();
  const { emoji, text } = LABEL[prefer];
  return (
    <button
      type="button"
      onClick={toggleAreaPrefer}
      aria-label={`Ranked by ${text}. Tap for ${prefer === "near" ? "Popular" : "Near"}`}
      className={cn(
        "border-foreground bg-card text-foreground flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition active:scale-[0.97]",
        className,
      )}
      data-area-prefer={prefer}
    >
      <span aria-hidden>{emoji}</span>
      <span>{text}</span>
      <span aria-hidden className="text-muted-foreground ml-0.5">
        ⇄
      </span>
    </button>
  );
}
