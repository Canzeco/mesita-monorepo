"use client";

import { Crown, Instagram, Smile } from "lucide-react";

import { CLASSES, classBadgeClass, isElevatedClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

export function CurrentClassCard() {
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key)!;
  const brand = `Mesita ${meta.label}`;
  const isElevated = isElevatedClass(key);
  const { Icon, via } = (() => {
    if (!isElevated) return { Icon: Smile, via: null as string | null };
    switch (origin) {
      case "instagram":
        return { Icon: Instagram, via: "via Instagram" };
      case "subscription":
        return { Icon: Crown, via: "via subscription" };
      case "invitation":
        return { Icon: Crown, via: "via invitation" };
      default:
        return { Icon: Crown, via: null as string | null };
    }
  })();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm",
        classBadgeClass(key),
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur",
          isElevated ? "bg-white/20" : "bg-foreground/[0.06]",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
          {brand}
        </h2>
        {via && (
          <p className="text-[11px] leading-snug opacity-100 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            {via}
          </p>
        )}
      </div>
    </div>
  );
}
