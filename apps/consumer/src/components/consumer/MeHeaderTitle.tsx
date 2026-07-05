"use client";

import { Crown, Instagram, Smile } from "lucide-react";
import { CLASSES, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

// Center title for the "me" surface. The page is titled "Me",
// with the member's current class (Free / Premium) shown right beside it
// as a class-tinted pill — the same icon language as the ClassChip avatar
// (Instagram / Crown for Premium, Smile for Free) plus the class label —
// so the class reads straight off the header.
export function MeHeaderTitle() {
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key);
  const isPremium = key === "premium";
  const Icon = !isPremium ? Smile : origin === "instagram" ? Instagram : Crown;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-display text-xl leading-tight font-semibold tracking-tight">
        Me
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-bold shadow-sm",
          classBadgeClass(key),
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            isPremium && origin !== "instagram" && "fill-current",
          )}
        />
        {meta?.label ?? "Free"}
      </span>
    </span>
  );
}
