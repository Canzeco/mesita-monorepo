"use client";

import { Check, Lock } from "lucide-react";

import { CLASSES, CLASS_ICONS, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

// The class rail (MESITA-972) — an at-a-glance strip of all four classes in
// canonical ladder order (Standard → Influencer → Premium → Aura) showing
// which DOORS the signed-in consumer holds open: the one that currently wins
// the slot, the ones unlocked underneath it (a paying Aura member keeps the
// Premium chip unlocked — the subscription runs on), and the locked ones with
// the one-word how. Pure status: the ladder is strictly increasing, so there
// is nothing to switch — the effective class is always the best open door.

const DOOR_HOW: Record<string, string> = {
  standard: "Base",
  influencer: "2,000+ IG",
  premium: "$100/mo",
  aura: "Invite",
};

export function ClassRail() {
  const { key, doors } = useConsumerClass();

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {CLASSES.map((c) => {
        const Icon = CLASS_ICONS[c.id];
        const current = key === c.id;
        // Standard is a door every account holds open.
        const unlocked =
          current || c.id === "standard" || doors[c.id as keyof typeof doors];
        return (
          <div
            key={c.id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center",
              current
                ? cn("shadow-sm", classBadgeClass(c.id))
                : unlocked
                  ? "border-border/70 bg-background border"
                  : "bg-muted/50",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                !current && !unlocked && "text-muted-foreground/70",
              )}
            />
            <span
              className={cn(
                "text-[11px] leading-none font-semibold",
                !current && !unlocked && "text-muted-foreground",
              )}
            >
              {c.label}
            </span>
            {current ? (
              <span className="text-[9px] font-bold tracking-[0.08em] uppercase opacity-90">
                Current
              </span>
            ) : unlocked ? (
              <span className="text-tier-premium flex items-center gap-0.5 text-[9px] font-bold tracking-[0.08em] uppercase">
                <Check className="h-2.5 w-2.5" /> Unlocked
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-0.5 text-[9px] font-medium">
                <Lock className="h-2.5 w-2.5" /> {DOOR_HOW[c.id]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
