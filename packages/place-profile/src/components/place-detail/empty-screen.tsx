"use client";

import { Store, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/format";
import { PLACE_SCREEN_TITLE_CLASS } from "../../lib/ui";

type PlaceEmptyScreenProps = {
  icon: LucideIcon;
  title: string;
  line: string;
};

/** Overview while a Google-only profile is being created (MESITA-2685).
 *  PlaceDetailBody draws it, and so does the opening screen's skeleton, so
 *  the words whose wrap sets its height are one (Pato, MESITA-2701: "the
 *  placeholders must be similar to the page you are loading, like the
 *  sizes"). */
export const NO_OVERVIEW: PlaceEmptyScreenProps = {
  icon: Store,
  title: "No overview yet",
  line: "The overview of this place will show up here.",
};

// A tab with nothing to show draws this one screen: the Soon tabs (Products,
// Rewards), a place with no reviews yet (MESITA-2682) and Overview while the
// profile is created (NO_OVERVIEW). The place scale (MESITA-2636): a grey
// chip with an ink glyph, an Inter title, a 14px muted line. No next step.
export function PlaceEmptyScreen({ icon: Icon, title, line }: PlaceEmptyScreenProps) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={2} aria-hidden />
      </span>
      <h3 className={cn(PLACE_SCREEN_TITLE_CLASS, "mt-4")}>{title}</h3>
      <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
        {line}
      </p>
    </div>
  );
}
