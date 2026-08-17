"use client";

import { Check, Lock } from "lucide-react";

import { CLASSES, CLASS_ICONS, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

// The class rail (MESITA-972, re-cut for Classes v2) — an at-a-glance strip of
// all four classes in canonical ladder order (Bronze → Silver → Gold →
// Diamond) showing which DOORS the signed-in consumer holds open: the one that
// currently wins the slot, the ones unlocked underneath it, and the locked
// ones with the one-word how. Pure status: the ladder is strictly increasing,
// so there is nothing to switch — the effective class is always the best open
// door.
//
// The rail is CLASS ONLY. Premium is not on it and must not be added: it buys
// a plan, not a rung, and a paid chip sitting in this strip is exactly the
// merge v2 removed. The plan has its own card in WaysToClimb.
//
// Both reach classes name the same door because the bands above the 2,000
// entry bar are operator-configured (Notion Main: "never hardcoded").
const DOOR_HOW: Record<string, string> = {
  bronze: "Base",
  silver: "2,000+ IG",
  gold: "More IG",
  diamond: "Invite",
};

export function ClassRail() {
  const { key, doors } = useConsumerClass();

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {CLASSES.map((c) => {
        const Icon = CLASS_ICONS[c.id];
        const current = key === c.id;
        // Bronze is a door every account holds open. The other three resolve
        // to the two v2 doors: reach carries Silver AND Gold (one Instagram
        // claim, banded by follower count), invitation carries Diamond.
        const unlocked =
          current ||
          c.id === "bronze" ||
          (c.id === "diamond" ? doors.invitation : doors.reach);
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
              <span className="flex items-center gap-0.5 text-[9px] font-bold tracking-[0.08em] text-emerald-700 uppercase">
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
