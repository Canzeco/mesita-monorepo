"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// Reusable "coming soon" dialog for parked surfaces (Reserve, Share, Rewards,
// Reservations, …). Callers open it on tap instead of showing a "Soon" pill —
// the surface stays tappable and the gate is one shared modal.
export function ComingSoonModal({
  open,
  onClose,
  title,
  body,
  icon: Icon = Sparkles,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: LucideIcon;
}) {
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel={title}>
      <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
        <span className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-base font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1.5 max-w-[280px] text-sm leading-relaxed">
          {body ??
            "We're still polishing this. It'll land here shortly — thanks for waiting."}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="bg-foreground text-background mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]"
        >
          Got it
        </button>
      </div>
    </LocalDialog>
  );
}
