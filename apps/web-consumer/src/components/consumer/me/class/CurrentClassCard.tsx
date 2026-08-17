"use client";

import { CLASSES, CLASS_ICONS, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

export function CurrentClassCard() {
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key)!;
  const brand = meta.label;
  // Off the floor on the CLASS axis alone. This used to read the plan too, so
  // a Bronze guest on Premium got the elevated treatment on the one card whose
  // entire job is to state the rung they earned (decision: Pato, MESITA-1122).
  const isElevated = key !== "bronze";
  // The class wears its canonical icon (medal / award / trophy / gem); the
  // origin only sets the "via" line.
  //
  // "via subscription" is gone on purpose: paying no longer grants a class, so
  // a Premium guest's CLASS was earned some other way (or not at all).
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
        {/* No plan mark here. The subscription's receipt lives on the Plan
            box, the Passport's Plan tile and /subscribe/premium — three
            surfaces that own it — so this card can say one thing only: the
            rung you earned. */}
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
