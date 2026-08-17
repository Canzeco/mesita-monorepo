"use client";

import {
  CLASSES,
  CLASS_ICONS,
  PREMIUM_PLAN_ICON as PlanIcon,
  classBadgeClass,
  isElevatedIdentity,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

export function CurrentClassCard() {
  const { key, plan, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key)!;
  const brand = meta.label;
  const isElevated = isElevatedIdentity({ cls: key, plan });
  // The class wears its canonical icon (medal / award / trophy / gem); the
  // origin only sets the "via" line.
  //
  // "via subscription" is gone on purpose: paying no longer grants a class, so
  // a Premium guest's CLASS was earned some other way (or not at all). The
  // plan gets its own line rather than explaining the rung above it.
  const Icon = CLASS_ICONS[key];
  const via =
    origin === "instagram"
      ? "via Instagram"
      : origin === "invitation"
        ? "via invitation"
        : null;
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
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
            {brand}
          </h2>
          {/* THE OTHER AXIS, and the card would lie without it. Before v2 a
              paying guest's class simply READ "Premium"; now their class is
              whatever they earned — usually Bronze — so with no plan mark the
              subscription would vanish from the one screen that owes them a
              receipt for it. Private still holds: this is the guest's own Me
              page, not the Passport a venue sees. */}
          {plan === "premium" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase backdrop-blur">
              <PlanIcon className="h-3 w-3" />
              Premium
            </span>
          )}
        </div>
        {via && (
          <p className="text-[11px] leading-snug opacity-100 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            {via}
          </p>
        )}
      </div>
    </div>
  );
}
