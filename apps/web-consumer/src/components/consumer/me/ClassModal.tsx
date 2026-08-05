"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { ClassPreviewToggle } from "@/components/consumer/me/class/ClassPreviewToggle";
import { CurrentClassCard } from "@/components/consumer/me/class/CurrentClassCard";
import { WaysToClimb } from "@/components/consumer/me/class/WaysToClimb";
import { CLASS_MARK_ICON } from "@/lib/consumer-data";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";

// The full class surface — bottom sheet from the Me Class box.
// IA: header → demo preview → You → Classes (Comparison removed MESITA-910/914).
// `onConnectInstagram` bubbles up so the parent can close this sheet before
// opening the verify sheet (two LocalSheets must never stack at the same
// z-layer).

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
            <CLASS_MARK_ICON className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your class</h2>
            <p className="text-muted-foreground text-[12px]">
              Reach, subscribe, or get invited — rewards climb with you.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ClassPreviewToggle />
          <section className="flex flex-col gap-2">
            <SectionEyebrow>You</SectionEyebrow>
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
