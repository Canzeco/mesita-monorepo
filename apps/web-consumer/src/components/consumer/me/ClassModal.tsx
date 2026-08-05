"use client";

import { Crown } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { ClassPreviewToggle } from "@/components/consumer/me/class/ClassPreviewToggle";
import { CurrentClassCard } from "@/components/consumer/me/class/CurrentClassCard";
import { WaysToClimb } from "@/components/consumer/me/class/WaysToClimb";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";

// The full class surface, lifted out of the old Class tab into a bottom sheet
// the Me page opens from the Class box. Two labeled sections top to bottom:
// current class, and the class cards with each ladder's door (subscribe /
// connect Instagram). ClimbCard detail bullets carry perk info (comparison
// table removed — MESITA-910). `onConnectInstagram` bubbles up so the parent
// can close this sheet before opening the verify sheet (two LocalSheets must
// never stack at the same z-layer).

export function ClassModal({
  open,
  onClose,
  onConnectInstagram,
}: {
  open: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your class">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your class</h2>
            <p className="text-muted-foreground text-[12px]">
              Mesita Standard, Mesita Influencer, Mesita Premium or Mesita Aura
              — and how to climb
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ClassPreviewToggle />
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Current class</SectionEyebrow>
            <CurrentClassCard />
          </section>
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Classes</SectionEyebrow>
            <WaysToClimb onConnectInstagram={onConnectInstagram} />
          </section>
        </div>
      </div>
    </LocalSheet>
  );
}
