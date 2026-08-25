"use client";

// Help — the single education home for the reward program (MESITA-809).
// Lives on Me, not on Rewards: the wallet is for doing, this is for
// understanding. Opened from the Me > Help row.
//
// Numbers never live here. A static ladder quoted Aggressive defaults as
// if they were every place's bill (MESITA-1017). The live sheet is the
// place Rewards tab; this list is the rungs, named.

import type { LucideIcon } from "lucide-react";
import {
  DoorOpen,
  Info,
  Instagram,
  Percent,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useConsumerClass } from "@/lib/class-context";
import {
  CLASS_FLOOR,
  CLASS_ICONS,
  CLASS_MARK_ICON,
  CLASS_ORDER,
  PREMIUM_PLAN_ICON,
  classProperLabel,
  type PlanKey,
} from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

type HelpRung = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  mine: boolean;
};

function RungRow({ icon: Icon, label, hint, mine }: Omit<HelpRung, "key">) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
        mine
          ? "bg-pink-gradient text-white"
          : "bg-muted/40 ring-border/50 ring-1 ring-inset",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg",
          mine ? "bg-white/20 text-white" : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="size-[14px]" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "type-body flex items-center gap-1.5 truncate leading-tight font-bold",
            mine ? "text-white" : "text-foreground",
          )}
        >
          {label}
          {mine ? (
            <span className="type-meta shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 font-extrabold tracking-widest uppercase">
              You
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "type-label mt-0.5 block truncate",
            mine ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      </span>
    </div>
  );
}

export function HelpRungList({
  classKey,
  plan,
}: {
  classKey: string;
  plan: PlanKey;
}) {
  const rungs: HelpRung[] = [
    {
      key: "base",
      label: "Base",
      hint: "Every guest, every visit",
      icon: Store,
      mine: false,
    },
    ...CLASS_ORDER.map((k) => ({
      key: k,
      label: classProperLabel(k),
      hint: "Earned, not bought",
      icon: CLASS_ICONS[k],
      mine: k === classKey,
    })),
    {
      key: "free",
      label: "Free",
      hint: "No subscription",
      icon: Star,
      mine: plan === "free",
    },
    {
      key: "premium",
      label: "Premium",
      hint: "Raises the rate at any class",
      icon: PREMIUM_PLAN_ICON,
      mine: plan === "premium",
    },
    {
      key: "welcome",
      label: "Welcome",
      hint: "First visit only",
      icon: DoorOpen,
      mine: false,
    },
    {
      key: "story",
      label: "Instagram Story",
      hint: "Needs a connected handle",
      icon: Instagram,
      mine: false,
    },
    {
      key: "google",
      label: "Google Review",
      hint: "Once per place",
      icon: Star,
      mine: false,
    },
    {
      key: "mesita",
      label: "Mesita Review",
      hint: "In the app, once per place",
      icon: UtensilsCrossed,
      mine: false,
    },
  ];

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-baseline justify-between px-1 pb-1">
        <h3 className="text-foreground text-sm font-bold tracking-tight">
          Every priced rung
        </h3>
        <span className="text-muted-foreground type-label">
          They add together
        </span>
      </div>
      {rungs.map(({ key, ...r }) => (
        <RungRow key={key} {...r} />
      ))}
    </div>
  );
}

export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { key: classKey, plan } = useConsumerClass();

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel="Help — how rewards work"
    >
      <div className="space-y-4 px-5 pt-4 pb-8">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
            <Info className="size-[18px]" />
          </span>
          <h2 className="text-foreground text-lg font-bold tracking-tight">
            How rewards work
          </h2>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-secondary/12 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <Percent className="size-[18px]" strokeWidth={2.25} />
          </span>
          <p className="text-muted-foreground type-body leading-relaxed">
            <span className="text-foreground font-semibold">
              Instant discounts.
            </span>{" "}
            Start a ticket, show its QR at the table — the discount comes
            straight off the bill. Mesita never holds your money.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-pink-gradient grid size-9 shrink-0 place-items-center rounded-xl text-white">
            <CLASS_MARK_ICON className="size-[18px]" />
          </span>
          <p className="text-muted-foreground type-body leading-relaxed">
            <span className="text-foreground font-semibold">
              Elevated classes boost them.
            </span>{" "}
            {CLASS_FLOOR.label} gets the base discount; every class above it
            unlocks a bigger one. Followers lift you automatically; an invite is
            by hand. Premium is a separate subscription that raises your rate at
            any class.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-secondary/12 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <Sparkles className="size-[18px]" strokeWidth={2.25} />
          </span>
          <p className="text-muted-foreground type-body leading-relaxed">
            <span className="text-foreground font-semibold">
              Actions add on.
            </span>{" "}
            Welcome, Instagram Story, Google Review, and Mesita Review stack
            on your class and plan — not pick-one. The bill clamps at 100% and
            applies to the first cap-pesos. Live percents sit on each
            place&apos;s Rewards tab.
          </p>
        </div>

        <HelpRungList classKey={classKey} plan={plan} />
      </div>
    </LocalSheet>
  );
}
